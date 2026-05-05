package llm

import (
	"strings"

	"konkatsu-diagnosis/internal/questions"
)

// CanonicalizeAnswers は API の map を設問一覧に揃え、選択肢 value を "1"〜"4" に正規化する。
// 全角数字・余計な空白・キー表記ゆれ（大文字小文字）に起因して default 扱いになり得点が潰れるのを防ぐ。
func CanonicalizeAnswers(answers map[string]string) map[string]string {
	qs := questions.All()
	out := make(map[string]string, len(qs))
	for _, q := range qs {
		v := strings.TrimSpace(answers[q.ID])
		if v == "" {
			for k, val := range answers {
				if strings.EqualFold(strings.TrimSpace(k), q.ID) {
					v = strings.TrimSpace(val)
					break
				}
			}
		}
		out[q.ID] = normalizeChoiceValue(v)
	}
	return out
}

func normalizeChoiceValue(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	r := []rune(v)
	if len(r) == 1 {
		switch r[0] {
		case '１':
			return "1"
		case '２':
			return "2"
		case '３':
			return "3"
		case '４':
			return "4"
		}
	}
	return v
}
