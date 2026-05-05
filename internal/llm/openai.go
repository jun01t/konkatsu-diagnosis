package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"konkatsu-diagnosis/internal/questions"
)

// Result は診断APIの返却形（JSON）。
type Result struct {
	Score     int      `json:"score"`
	Headline  string   `json:"headline"`
	Bullets   []string `json:"bullets"`
	ShareText string   `json:"shareText"`
}

type chatRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	Temperature    float64         `json:"temperature"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Diagnose は回答からスコアと解説を生成する。OPENAI_API_KEY が無い場合はモックを返す。
func Diagnose(ctx context.Context, answers map[string]string) (Result, error) {
	answers = CanonicalizeAnswers(answers)
	key := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if key == "" {
		return mockResult(answers), nil
	}
	return callOpenAI(ctx, key, answers)
}

func callOpenAI(ctx context.Context, apiKey string, answers map[string]string) (Result, error) {
	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "gpt-4o-mini"
	}

	ref := scoreFromAnswers(answers)
	userPayload := buildUserContent(answers, ref)
	sys := `あなたは日本語の婚活コーチのトーンで、短く具体的に返す。
` + questions.ScoreGuide + `
必ず次のJSONだけを返す（説明文やコードフェンスは禁止）:
{"score":整数,"headline":"28文字以内の前向きな一言","bullets":["箇条書き1","箇条書き2","箇条書き3"],"shareText":"X投稿用。スコアと一言とハッシュタグを含め280文字以内"}

JSON の score は、ユーザー文に書かれた「算出済みの目安スコア」と必ず同じ整数にすること（別の数値を推測しない）。
bulletsは各40文字以内。shareTextには「婚活偏差値〇〇」（〇〇はそのscore）「#婚活偏差値診断」を含める。
「改善」「見直し」中心の文言はスコアが低いときだけ。スコアが高めのときは強みの維持・仕上げの観点を中心に。`

	body := chatRequest{
		Model:       model,
		Temperature: 0.5,
		Messages: []chatMessage{
			{Role: "system", Content: sys},
			{Role: "user", Content: userPayload},
		},
		ResponseFormat: &responseFormat{Type: "json_object"},
	}

	raw, err := json.Marshal(body)
	if err != nil {
		return Result{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return Result{}, err
	}

	var cr chatResponse
	if err := json.Unmarshal(b, &cr); err != nil {
		return Result{}, fmt.Errorf("openai response parse: %w", err)
	}
	if cr.Error != nil && cr.Error.Message != "" {
		return Result{}, errors.New(cr.Error.Message)
	}
	if len(cr.Choices) == 0 {
		return Result{}, errors.New("openai: empty choices")
	}

	content := strings.TrimSpace(cr.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var out Result
	if err := json.Unmarshal([]byte(content), &out); err != nil {
		return Result{}, fmt.Errorf("json decode result: %w", err)
	}
	// スコアは回答集計のみ（value 1=加点多・4=加点少）。LLM の score はプロンプト整合用のみで上書きする。
	out.Score = ref
	out = normalizeResult(out)
	return out, nil
}

func buildUserContent(answers map[string]string, answerBasedScore int) string {
	var b strings.Builder
	b.WriteString("次の設問に対する回答です。\n")
	b.WriteString("各 value は 1=その項目で最も好調・4=改善余地が大きい（数字が小さいほど良い回答）。\n\n")
	for _, q := range questions.All() {
		v := answers[q.ID]
		b.WriteString("- ")
		b.WriteString(q.ID)
		b.WriteString(" ")
		b.WriteString(q.Text)
		b.WriteString(" => value=")
		b.WriteString(v)
		if lbl := optionLabel(q, v); lbl != "" {
			b.WriteString("（")
			b.WriteString(lbl)
			b.WriteString("）")
		}
		b.WriteString("\n")
	}
	b.WriteString("\n【算出済み・この値を JSON の score に必ず使う】婚活偏差値っぽいスコア（目安）: ")
	b.WriteString(fmt.Sprintf("%d\n", answerBasedScore))
	b.WriteString("（value=1 が多いほどこの数値は高く、value=4 が多いほど低くなる計算です。）")
	return b.String()
}

func optionLabel(q questions.Question, value string) string {
	for _, o := range q.Options {
		if o.Value == value {
			return o.Label
		}
	}
	return ""
}

func normalizeResult(r Result) Result {
	if r.Score < 35 {
		r.Score = 35
	}
	if r.Score > 75 {
		r.Score = 75
	}
	if len(r.Bullets) > 3 {
		r.Bullets = r.Bullets[:3]
	}
	r.ShareText = strings.TrimSpace(r.ShareText)
	if len([]rune(r.ShareText)) > 280 {
		rs := []rune(r.ShareText)
		r.ShareText = string(rs[:280])
	}
	return r
}

// scoreFromAnswers は value 1=最良（加点大）・4=最も課題（加点小）を 35〜75 に線形マップする。
// 設問数が変わっても破綻しないよう、合計点レンジは設問数から算出する。
func scoreFromAnswers(answers map[string]string) int {
	qs := questions.All()
	n := len(qs)
	if n == 0 {
		return 35
	}
	sum := 0
	for _, q := range qs {
		v := answers[q.ID]
		switch v {
		case "1": // 最良の自己評価
			sum += 4
		case "2":
			sum += 3
		case "3":
			sum += 2
		case "4": // 改善余地が大きい
			sum += 1
		default:
			sum += 2
		}
	}
	minSum := n * 1 // すべて value=4
	maxSum := n * 4 // すべて value=1
	if minSum >= maxSum {
		return 40
	}
	// sum を [minSum,maxSum] から [40,70] へ線形変換
	score := 40 + (sum-minSum)*30/(maxSum-minSum)
	if score < 35 {
		score = 35
	}
	if score > 75 {
		score = 75
	}
	return score
}

// mockResult はAPIキー無しのローカル確認用（決定的なダミー）。
func mockResult(answers map[string]string) Result {
	score := scoreFromAnswers(answers)
	headline := "いまのペースを整えると伸びしろがあります"
	if score >= 60 {
		headline = "土台は良いので、言語化と行動量でさらに安定しそう"
	}
	bullets := []string{
		"プロフィールは「目的・週の稼働・得意」を一文ずつ足すと伝わりやすい",
		"初回メッセージは相手プロフィールの一要素に触れると続きやすい",
		"疲れが続くなら、接触頻度より睡眠と回復ルートを先に整える",
	}
	st := fmt.Sprintf("婚活偏差値っぽいスコア: %d（診断・エンタメ）\n%s\n#婚活偏差値診断", score, headline)
	return Result{
		Score:     score,
		Headline:  headline,
		Bullets:   bullets,
		ShareText: st,
	}
}
