package questions

// Question は診断の1問（単一選択）。
type Question struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	Options  []Option `json:"options"`
	Category string   `json:"category"`
}

// Option は選択肢。
type Option struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// ScoreGuide はAIへのスコア算出の説明用（固定文言）。
const ScoreGuide = `スコアは「婚活偏差値」という比喩で、35〜75の整数で出力する。
意味は「その時点でのプロフィール整備・行動・コミュニケーションのバランス」をざっくり示す娯楽指標。
医学的診断・人の価値の判定ではない。極端に高い/低い表現は避け、前向きな言い回しにする。`

// All はMVPの設問一覧（8問）。
func All() []Question {
	return []Question{
		{
			ID:       "q1",
			Category: "プロフィール",
			Text:     "自己紹介文は、相手に「何を期待して合うか」が具体的に書けていますか？",
			Options: []Option{
				{Value: "1", Label: "かなり具体（会う目的・価値観が明確）"},
				{Value: "2", Label: "少し具体（雰囲気は伝わる）"},
				{Value: "3", Label: "曖昧（趣味羅列が主）"},
				{Value: "4", Label: "未記入/ほぼ空欄に近い"},
			},
		},
		{
			ID:       "q2",
			Category: "プロフィール",
			Text:     "写真（顔/全身/活動）のバリエーションは？",
			Options: []Option{
				{Value: "1", Label: "3枚以上、状況が違う写真があり信頼感が出る"},
				{Value: "2", Label: "2枚前後、悪くはないが単調"},
				{Value: "3", Label: "1枚中心/雰囲気が分かりづらい"},
				{Value: "4", Label: "不明瞭・古い・または載せていない"},
			},
		},
		{
			ID:       "q3",
			Category: "コミュニケーション",
			Text:     "最初のメッセージはどんな傾向ですか？",
			Options: []Option{
				{Value: "1", Label: "相手プロフィールに触れ、質問があり続きやすい"},
				{Value: "2", Label: "一言挨拶中心だが失礼はない"},
				{Value: "3", Label: "テンプレっぽく短文"},
				{Value: "4", Label: "返信が続きにくい（一方的/長すぎる等）"},
			},
		},
		{
			ID:       "q4",
			Category: "コミュニケーション",
			Text:     "返信の「速度」と「温度感」の自己評価は？",
			Options: []Option{
				{Value: "1", Label: "24〜48時間以内が多く、丁寧さも保てる"},
				{Value: "2", Label: "遅れがちだが文章は丁寧"},
				{Value: "3", Label: "忙しさでぶれが大きい"},
				{Value: "4", Label: "返信が続かない/すぐ短くなることが多い"},
			},
		},
		{
			ID:       "q5",
			Category: "行動",
			Text:     "新規アプリ登録やイベント参加など、相手候補に出会う行動量は？",
			Options: []Option{
				{Value: "1", Label: "週に複数回は触る/参加もする"},
				{Value: "2", Label: "週1前後は続いている"},
				{Value: "3", Label: "月に数回"},
				{Value: "4", Label: "長期停止気味"},
			},
		},
		{
			ID:       "q6",
			Category: "行動",
			Text:     "デートの提案・日程調整は？",
			Options: []Option{
				{Value: "1", Label: "候補日を出して進めやすい"},
				{Value: "2", Label: "相手任せになりがちだが進むことはある"},
				{Value: "3", Label: "迷いが長く間が空きやすい"},
				{Value: "4", Label: "そもそも日程まで進みにくい"},
			},
		},
		{
			ID:       "q7",
			Category: "マインド",
			Text:     "「条件」の優先順位は整理できていますか？",
			Options: []Option{
				{Value: "1", Label: "譲れない点と柔らげられる点が言語化できている"},
				{Value: "2", Label: "だいたい分かるが迷いもある"},
				{Value: "3", Label: "理想が多くて優先が散らかりがち"},
				{Value: "4", Label: "あまり考えたことがない"},
			},
		},
		{
			ID:       "q8",
			Category: "マインド",
			Text:     "最近の婚活で、ストレスをどう処理していますか？",
			Options: []Option{
				{Value: "1", Label: "睡眠/運動/友人など回復ルートがある"},
				{Value: "2", Label: "たましんどいがなんとか"},
				{Value: "3", Label: "不安や疲れがち"},
				{Value: "4", Label: "強い疲労/不信感が強い"},
			},
		},
	}
}
