export type NewsletterSubscriptionData = {
  email: string;
  level: string;
  categories: string[];
} & (
  | { name: string; firstName?: string }
  | { name?: string; firstName: string }
);

export type NewsletterResponse = {
  success: boolean;
  userId?: string;
  status?: "available" | "already_exists" | "ok" | "error";
  error?: string;
};

export const DEFAULT_GAS_URL =
  "https://script.google.com/macros/s/AKfycbxUb-hUABm9TodggnQgnxrXjhmFzhxQxo-7beGqTdTLAlkI_kdEjQUXGeLMrq9Lhvg1QQ/exec";

const REQUEST_TIMEOUT_MS = 10_000;

type GasResponse = {
  status?: unknown;
  userId?: unknown;
  message?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (isRecord(value) && typeof value.message === "string" && value.message) {
    return value.message;
  }
  return fallback;
}

function isGasResponse(value: unknown): value is GasResponse {
  return isRecord(value);
}

/** Returns an email address suitable for the GAS validation rules. */
export function validateEmail(
  email: string
): { valid: boolean; error?: string } {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return { valid: false, error: "Email address is required." };
  }

  if (normalizedEmail.length < 5 || normalizedEmail.length > 254) {
    return {
      valid: false,
      error: "Email address must be between 5 and 254 characters.",
    };
  }

  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return { valid: false, error: "Enter a valid email address." };
  }

  return { valid: true };
}

/** Uses the build-time public GAS URL when configured, otherwise the app default. */
export function getScriptUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || DEFAULT_GAS_URL;
}

async function postJson(
  payload: Record<string, unknown>,
  keepalive = false
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("Newsletter request timed out."));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(getScriptUrl(), {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          ...(keepalive ? { keepalive: true } : {}),
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        return { response, data };
      })(),
      timeout,
    ]);
  } catch (error) {
    if (timedOut) {
      throw new Error("Newsletter request timed out.");
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function checkEmailAvailability(
  email: string
): Promise<{ available: boolean; error?: string }> {
  const validation = validateEmail(email);
  if (!validation.valid) {
    return { available: false, error: validation.error };
  }

  try {
    const { response, data } = await postJson({
      action: "check_email",
      email: email.trim().toLowerCase(),
    });

    if (!response.ok) {
      return {
        available: false,
        error: getErrorMessage(data, "Unable to check email availability."),
      };
    }

    if (!isGasResponse(data)) {
      return { available: false, error: "Invalid response from newsletter API." };
    }

    if (data.status === "available") return { available: true };
    if (data.status === "already_exists") return { available: false };

    return {
      available: false,
      error: getErrorMessage(data, "Unable to check email availability."),
    };
  } catch (error) {
    return {
      available: false,
      error: getErrorMessage(error, "Unable to check email availability."),
    };
  }
}

export async function submitNewsletterSubscription(
  data: NewsletterSubscriptionData
): Promise<NewsletterResponse> {
  const validation = validateEmail(data.email);
  if (!validation.valid) {
    return { success: false, status: "error", error: validation.error };
  }

  const payload = {
    email: data.email.trim().toLowerCase(),
    name: (data.name ?? data.firstName ?? "").trim(),
    level: data.level,
    categories: data.categories,
  };

  try {
    const { response, data: responseData } = await postJson(payload, true);
    if (!response.ok) {
      return {
        success: false,
        status: "error",
        error: getErrorMessage(responseData, "Newsletter registration failed."),
      };
    }

    if (!isGasResponse(responseData)) {
      return {
        success: false,
        status: "error",
        error: "Invalid response from newsletter API.",
      };
    }

    if (responseData.status === "ok") {
      return {
        success: true,
        status: "ok",
        ...(typeof responseData.userId === "string"
          ? { userId: responseData.userId }
          : {}),
      };
    }

    if (responseData.status === "already_exists") {
      return {
        success: false,
        status: "already_exists",
        error: getErrorMessage(responseData, "This email is already registered."),
      };
    }

    return {
      success: false,
      status: "error",
      error: getErrorMessage(responseData, "Newsletter registration failed."),
    };
  } catch (error) {
    return {
      success: false,
      status: "error",
      error: getErrorMessage(error, "Newsletter request failed."),
    };
  }
}
