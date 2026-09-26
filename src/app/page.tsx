import FuragoApp, { Article } from "@/components/FuragoApp";

async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(
      "https://kohaiducode.github.io/furago-data/articles.json"
    );
    if (!res.ok) return [];
    const data = await res.json();
    const valid: Article[] = (data.articles || []).filter(
      (a: Article) => a.levels && Object.keys(a.levels).length > 0
    );
    valid.sort((a, b) => {
      const dA = a.date ? new Date(a.date).getTime() : 0;
      const dB = b.date ? new Date(b.date).getTime() : 0;
      return dB - dA;
    });
    return valid;
  } catch (e) {
    console.error("Erreur de chargement des articles", e);
    return [];
  }
}

export default async function Home() {
  const articles = await getArticles();

  return <FuragoApp initialArticles={articles} />;
}
