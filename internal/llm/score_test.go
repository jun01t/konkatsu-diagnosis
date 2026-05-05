package llm

import (
	"testing"

	"konkatsu-diagnosis/internal/questions"
)

func TestScoreFromAnswers_allOnesHigherThanAllFours(t *testing.T) {
	all1 := map[string]string{}
	all4 := map[string]string{}
	for _, q := range questions.All() {
		all1[q.ID] = "1"
		all4[q.ID] = "4"
	}
	s1 := scoreFromAnswers(all1)
	s4 := scoreFromAnswers(all4)
	if s1 <= s4 {
		t.Fatalf("value=1 ばかり(%d)は value=4 ばかり(%d)より高い必要がある", s1, s4)
	}
}

func TestScoreFromAnswers_allOnesInRange(t *testing.T) {
	m := map[string]string{}
	for _, q := range questions.All() {
		m[q.ID] = "1"
	}
	s := scoreFromAnswers(m)
	if s < 35 || s > 75 {
		t.Fatalf("全1: %d", s)
	}
	if s < 60 {
		t.Fatalf("全て最良の選択(value=1)なら60台以上が期待されるが %d", s)
	}
}

func TestScoreFromAnswers_fullwidthOneSameAsASCII(t *testing.T) {
	fw := map[string]string{}
	ascii := map[string]string{}
	for _, q := range questions.All() {
		fw[q.ID] = "１"
		ascii[q.ID] = "1"
	}
	sFW := scoreFromAnswers(CanonicalizeAnswers(fw))
	sASCII := scoreFromAnswers(CanonicalizeAnswers(ascii))
	if sFW != sASCII {
		t.Fatalf("全角1(%d)とASCII 1(%d)が一致すべき", sFW, sASCII)
	}
}
