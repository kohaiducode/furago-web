export type AppLanguage = 'ja' | 'en';

export const translations = {
  ja: {
    appTitle: 'Furago',
    levels: {
      LVL_1: '超初級',
      LVL_2: '初級',
      LVL_3: '中級',
      LVL_4: '上級'
    },
    nav: {
      home: '記事',
      words: '単語帳',
      progress: '進捗',
      register: '登録',
      leadBarText: '最新記事をメールでお届け！無料メルマガ登録',
      leadBarBtn: '登録',
      level: 'レベル',
      category: 'カテゴリー'
    },
    reading: {
      read: '読む',
      quiz: 'クイズ',
      showTranslation: '翻訳を表示',
      hideTranslation: '翻訳を隠す',
      prevSentence: '前の文',
      playPause: '再生 / 一時停止',
      nextSentence: '次の文',
      restartAudio: '最初から再生',
      audioSpeed: '音声スピード',
      selectVoice: '音声の選択',
      selectLevel: 'レベルを選択',
      selectCategory: 'カテゴリーを選択',
      translateQuestion: '翻訳を表示',
      translateAnswer: '答えを翻訳する',
      tapHint: '💡 単語をタップ（またはクリック）すると日本語の意味と文脈翻訳が表示されます'
    },
    quiz: {
      score: 'スコア',
      correct: '正解！',
      wrong: '不正解...',
      nextQuestion: '次の問題',
      finish: '終了',
      results: '結果',
      outOf: '/',
      points: '点',
      backToArticle: '記事に戻る'
    },
    dict: {
      save: '保存',
      saveToList: '単語リストに保存',
      createList: 'リストを作成',
      createNewList: '新しいリストを作成',
      add: '追加',
      noDef: '定義が見つかりません',
      loading: '検索中...',
      context: '文脈',
      lemma: '原形'
    },
    words: {
      title: '単語帳',
      noWords: '単語がありません',
      delete: '削除',
      date: '日付',
      allLists: 'すべてのリスト',
      defaultList: 'デフォルト',
      wordCount: '単語',
      newList: '新しいリスト',
      list: 'リスト',
      emptyList: 'このリストは空です。\n記事内でフランス語の単語をタップして追加しましょう！',
      lemmaPrefix: '原形:',
      listenPronunciation: '発音を聞く',
      selectListToSave: '保存先リストを選択',
      cancel: 'キャンセル',
      newListNameTitle: '新しいリストの名前',
      newListPlaceholder: '例：旅行フレーズ、動詞...',
      create: '作成'
    },
    toasts: {
      alreadyInList: 'すでにリストにあります',
      saved: '保存しました !',
      listCreated: 'リストを作成しました',
      deleted: '削除しました',
      emailRegistered: 'このメールアドレスは既に登録されています。',
      enterAllFields: 'すべての項目を入力・選択してください。',
      selectCategory: '興味のあるカテゴリーを1つ以上選んでください。',
      registrationSuccess: 'ご登録ありがとうございます！確認メールを送信しました。'
    },
    newsletter: {
      title: 'Furago ニュースレター登録',
      step1: '基本情報',
      step2: 'フランス語レベル',
      step3: '興味のあるテーマ',
      name: '名前',
      email: 'メールアドレス',
      gender: '性別',
      cancel: 'キャンセル',
      register: '登録',
      submit: '登録する'
    },
    habit: {
      title: '今日の習慣',
      mission: 'ミッション',
      review: '復習ボーナス',
      learningDay: '学習日',
      statusDone: '完了',
      statusPending: '未完了',
      atRiskTitle: '今日の学習でストリークをつなげましょう',
      atRiskBody: '{streak}日連続の学習記録です。今日の読書または復習で記録をつなげられます。',
      doneTodayTitle: '今日の学習日は完了しました',
      doneTodayBody: '{streak}日連続の学習を続けています。',
      brokenTitle: '新しいストリークを始めましょう',
      brokenBody: '今日の一読または復習で、新しい記録が始まります。',
      ctaReview: '単語を復習する',
      ctaContinue: '続きを読む',
      ctaMission: '今日のミッションを読む',
      ctaExplore: '記事を見つける'
    },
    common: {
      close: '閉じる',
      back: '戻る',
      email: 'メールアドレス'
    },
    home: {
      continueTitle: '続きから',
      continueSeriesTitle: 'シリーズの続き',
      continueCta: '続きを読む',
      nextEpisodeCta: '次のエピソードへ',
      episode: 'エピソード {n}',
      missionTag: '🎯 今日のミッション対象の記事です',
      readingProgress: '読了率',
      reviewSection: '復習',
      reviewDue: '{count}語が復習待ち',
      reviewDueOne: '{count}語が復習待ち',
      reviewBeforeForget: '忘れる前に確認しよう',
      reviewCta: '復習する',
      reviewEmptyNoWords: '記事を読み終えると、ここに復習する単語が追加されます',
      reviewNoneLaterToday: '✅ 今は復習なし · 次は今日中',
      reviewNoneTomorrow: '✅ 復習完了 · 次は明日',
      reviewNoneInDays: '✅ 復習完了 · 次は{days}日後',
      reviewNone: '✅ 復習完了',
      practiceSaved: '保存した単語を練習する（{count}）',
      missionSection: '今日のミッション',
      missionComplete: '✅ ミッション完了！明日また新しいミッションが届きます',
      missionContinueHint: '🎯 読みかけの記事を最後まで読もう（上の「続きを読む」）',
      missionFinish: '🎯 この記事を読み終えよう',
      missionMeta: 'ボーナスXP · ストリーク継続',
      recommended: 'あなたへのおすすめ',
      allArticles: 'すべての記事',
      loading: '読み込み中...',
      loadError: '記事を読み込めませんでした。ネットワーク接続を確認してください。',
      retry: '再試行',
      emptyResult: '条件に一致する記事は見つかりませんでした。'
    },
    progress: {
      title: 'マイプログレス',
      subtitle: 'これまでの学習の記録です。',
      viewDetails: '詳細を見る',
      empty: '最初の記事を読んで、進捗を積み上げましょう。',
      consolidatedWords: '定着した単語',
      currentLevel: '学習中のレベル',
      levelNotSet: '未設定',
      currentGoal: '現在の目標',
      goalEmpty: '学習を続けて進捗を積み上げましょう。',
      goalCtaReview: '単語を復習する',
      goalCtaRead: '記事を読む',
      articlesRead: '読んだ記事',
      continueLearning: '学習を続ける',
      vocabulary: '語彙の習得状況',
      vocabularyEmpty: 'まだ学習した単語がありません。記事を読んで単語を追加しましょう。',
      inStudy: '学習中',
      consolidating: '定着中',
      consolidated: '定着済み',
      readingLog: '読解の記録',
      readingLogEmpty: '最初の記事を読み終えると、ここに記録が表示されます。',
      perfectQuizzes: 'クイズ満点',
      completedByLevel: 'レベル別クリア数',
      unknownLevel: 'レベル未設定',
      learningHabit: '学習の習慣',
      currentStreak: '連続学習',
      bestStreak: '最長記録',
      streak: 'ストリーク',
      days: '日',
      canDo: 'できること (Can-Do)'
    },
    goals: {
      GOAL_VOCAB_START: {
        title: '語彙を定着させる',
        description: '10語を定着させて、しっかりした基礎をつくりましょう。'
      },
      GOAL_READ_MORE: {
        title: '読解の練習',
        description: '3記事を読み終えて、読むことに慣れましょう。'
      },
      GOAL_QUIZ_PERFECT: {
        title: '正確な理解',
        description: 'クイズで2回満点を獲得して、理解力を証明しましょう。'
      },
      GOAL_CONSOLIDATE_MORE: {
        title: '語彙をさらに広げる',
        description: '{target}語を定着させましょう。'
      }
    },
    canDos: {
      'CAN-DO-READ-01': {
        title: '短い文章の要旨を理解できます。',
        criteria: '5記事の完了が必要です。'
      },
      'CAN-DO-READ-02': {
        title: '文章から正確な情報を見つけられます。',
        criteria: '満点のクイズが3回必要です。'
      },
      'CAN-DO-VOCAB-01': {
        title: '読んだ文章に出てくる頻出語彙を覚えて定着させられます。',
        criteria: '定着済みの単語が20語必要です。'
      },
      'CAN-DO-CONTENT-01': {
        title: '中級レベルの文章を読んで理解できます。',
        criteria: 'レベル2以上の記事を1記事以上完了する必要があります。'
      },
      'CAN-DO-HABIT-01': {
        title: '初級コンテンツを継続的に学習できます。',
        criteria: '3日間の連続記録が必要です。'
      }
    }
  },
  en: {
    appTitle: 'Furago',
    levels: {
      LVL_1: 'Absolute Beginner',
      LVL_2: 'Beginner',
      LVL_3: 'Intermediate',
      LVL_4: 'Advanced'
    },
    nav: {
      home: 'Articles',
      words: 'Vocabulary',
      progress: 'Progress',
      register: 'Register',
      leadBarText: 'Get the latest articles by email! Free newsletter',
      leadBarBtn: 'Register',
      level: 'Level',
      category: 'Category'
    },
    reading: {
      read: 'Read',
      quiz: 'Quiz',
      showTranslation: 'Show Translation',
      hideTranslation: 'Hide Translation',
      prevSentence: 'Prev Sentence',
      playPause: 'Play / Pause',
      nextSentence: 'Next Sentence',
      restartAudio: 'Restart Audio',
      audioSpeed: 'Audio Speed',
      selectVoice: 'Select Voice',
      selectLevel: 'Select Level',
      selectCategory: 'Select Category',
      translateQuestion: 'Show Translation',
      translateAnswer: 'Translate Answer',
      tapHint: '💡 Tap (or click) a word to see its translation and context.'
    },
    quiz: {
      score: 'Score',
      correct: 'Correct!',
      wrong: 'Incorrect...',
      nextQuestion: 'Next Question',
      finish: 'Finish',
      results: 'Results',
      outOf: '/',
      points: 'points',
      backToArticle: 'Back to Article'
    },
    dict: {
      save: 'Save',
      saveToList: 'Save to List',
      createList: 'Create List',
      createNewList: 'Create New List',
      add: 'Add',
      noDef: 'Definition not found',
      loading: 'Loading...',
      context: 'Context',
      lemma: 'Lemma'
    },
    words: {
      title: 'Vocabulary',
      noWords: 'No words found',
      delete: 'Delete',
      date: 'Date',
      allLists: 'All Lists',
      defaultList: 'Default',
      wordCount: 'words',
      newList: 'New List',
      list: 'List',
      emptyList: 'This list is empty.\nTap French words in articles to add them!',
      lemmaPrefix: 'Lemma:',
      listenPronunciation: 'Listen to pronunciation',
      selectListToSave: 'Select list to save',
      cancel: 'Cancel',
      newListNameTitle: 'New list name',
      newListPlaceholder: 'e.g. Travel phrases, Verbs...',
      create: 'Create'
    },
    toasts: {
      alreadyInList: 'Already in the list',
      saved: 'Saved!',
      listCreated: 'List created',
      deleted: 'Deleted',
      emailRegistered: 'This email is already registered.',
      enterAllFields: 'Please fill in all fields.',
      selectCategory: 'Please select at least one category.',
      registrationSuccess: 'Thank you for registering! A confirmation email has been sent.'
    },
    newsletter: {
      title: 'Furago Newsletter Registration',
      step1: 'Basic Info',
      step2: 'French Level',
      step3: 'Interests',
      name: 'Name',
      email: 'Email',
      gender: 'Gender',
      cancel: 'Cancel',
      register: 'Register',
      submit: 'Submit'
    },
    habit: {
      title: "Today's habit",
      mission: 'Mission',
      review: 'Review bonus',
      learningDay: 'Learning day',
      statusDone: 'Done',
      statusPending: 'Pending',
      atRiskTitle: 'Keep your learning day going',
      atRiskBody: 'You have a {streak}-day learning streak. Reading or reviewing today keeps it going.',
      doneTodayTitle: "Today's learning day is secured",
      doneTodayBody: 'You are on a {streak}-day learning streak.',
      brokenTitle: 'Start a new streak today',
      brokenBody: 'A single reading or review session today starts a new run.',
      ctaReview: 'Review words',
      ctaContinue: 'Continue reading',
      ctaMission: "Read today's mission",
      ctaExplore: 'Find an article'
    },
    common: {
      close: 'Close',
      back: 'Back',
      email: 'Email address'
    },
    home: {
      continueTitle: 'Continue',
      continueSeriesTitle: 'Continue the series',
      continueCta: 'Continue reading',
      nextEpisodeCta: 'Next episode',
      episode: 'Episode {n}',
      missionTag: "🎯 This is today's mission",
      readingProgress: 'Reading progress',
      reviewSection: 'Review',
      reviewDue: '{count} words due',
      reviewDueOne: '{count} word due',
      reviewBeforeForget: 'Review them before you forget',
      reviewCta: 'Review',
      reviewEmptyNoWords: 'Finish an article to add words to review',
      reviewNoneLaterToday: '✅ Nothing due now · next review later today',
      reviewNoneTomorrow: '✅ All caught up · next review tomorrow',
      reviewNoneInDays: '✅ All caught up · next review in {days} days',
      reviewNone: '✅ All caught up',
      practiceSaved: 'Practice my saved words ({count})',
      missionSection: "Today's mission",
      missionComplete: '✅ Mission complete! A new one arrives tomorrow',
      missionContinueHint: '🎯 Finish the article you started (above)',
      missionFinish: '🎯 Finish this article',
      missionMeta: 'Bonus XP · keeps your streak',
      recommended: 'Recommended for you',
      allArticles: 'All articles',
      loading: 'Loading...',
      loadError: 'Could not load articles. Please check your network connection.',
      retry: 'Retry',
      emptyResult: 'No articles found matching the criteria.'
    },
    progress: {
      title: 'My Progress',
      subtitle: 'Here is what you have worked on so far.',
      viewDetails: 'View details',
      empty: 'Read your first article to start building your progress.',
      consolidatedWords: 'Consolidated words',
      currentLevel: 'Current level',
      levelNotSet: 'Not set',
      currentGoal: 'Current goal',
      goalEmpty: 'Keep learning to build your progress.',
      goalCtaReview: 'Review words',
      goalCtaRead: 'Read an article',
      articlesRead: 'Articles read',
      continueLearning: 'Continue learning',
      vocabulary: 'Vocabulary progress',
      vocabularyEmpty: "You haven't encountered any words yet. Read articles to find new words!",
      inStudy: 'In study',
      consolidating: 'Consolidating',
      consolidated: 'Consolidated',
      readingLog: 'Reading log',
      readingLogEmpty: 'Finish your first article to see your reading log here.',
      perfectQuizzes: 'Perfect quizzes',
      completedByLevel: 'Completed by level',
      unknownLevel: 'Level not set',
      learningHabit: 'Learning habit',
      currentStreak: 'Current streak',
      bestStreak: 'Best streak',
      streak: 'Streak',
      days: 'days',
      canDo: 'My skills (Can-Do)'
    },
    goals: {
      GOAL_VOCAB_START: {
        title: 'Build a vocabulary foundation',
        description: 'Consolidate 10 words to build a solid base.'
      },
      GOAL_READ_MORE: {
        title: 'Reading practice',
        description: 'Finish 3 articles to get comfortable reading.'
      },
      GOAL_QUIZ_PERFECT: {
        title: 'Precise comprehension',
        description: 'Get 2 perfect quiz scores to prove your understanding.'
      },
      GOAL_CONSOLIDATE_MORE: {
        title: 'Expand your vocabulary',
        description: 'Reach {target} consolidated words.'
      }
    },
    canDos: {
      'CAN-DO-READ-01': {
        title: 'I can understand the general idea of short texts.',
        criteria: 'Requires 5 completed articles.'
      },
      'CAN-DO-READ-02': {
        title: 'I can find specific information in a text.',
        criteria: 'Requires 3 perfect quizzes.'
      },
      'CAN-DO-VOCAB-01': {
        title: 'I recognize and consolidate frequent vocabulary from my reading.',
        criteria: 'Requires 20 consolidated words.'
      },
      'CAN-DO-CONTENT-01': {
        title: 'I can read and understand intermediate-level texts.',
        criteria: 'Requires at least one completed level 2 (or higher) article.'
      },
      'CAN-DO-HABIT-01': {
        title: 'I can study elementary content regularly.',
        criteria: 'Requires a 3-day streak.'
      }
    }
  }
};

export const getTranslation = (lang: AppLanguage) => translations[lang] || translations.ja;

/** Structural shape of a pedagogical goal (progress engine) used only for text lookup. */
export interface GoalLike {
  id: string;
  title: string;
  description: string;
  target: number;
}

/** Structural shape of a can-do skill (progress engine) used only for text lookup. */
export interface CanDoLike {
  id: string;
  title: string;
  criteriaDescription: string;
}

/** Localized goal copy; falls back to the value produced by the progress engine. */
export const getGoalText = (
  lang: AppLanguage,
  goal: GoalLike
): { title: string; description: string } => {
  const goals = translations[lang].goals;
  const entry = goals[goal.id as keyof typeof goals];
  return {
    title: entry?.title ?? goal.title,
    description: (entry?.description ?? goal.description).replace("{target}", String(goal.target)),
  };
};

/** Localized can-do copy; falls back to the value produced by the progress engine. */
export const getCanDoText = (
  lang: AppLanguage,
  skill: CanDoLike
): { title: string; criteria: string } => {
  const canDos = translations[lang].canDos;
  const entry = canDos[skill.id as keyof typeof canDos];
  return {
    title: entry?.title ?? skill.title,
    criteria: entry?.criteria ?? skill.criteriaDescription,
  };
};
