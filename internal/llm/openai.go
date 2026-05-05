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

	userPayload := buildUserContent(answers)
	sys := `あなたは日本語の婚活コーチのトーンで、短く具体的に返す。
` + questions.ScoreGuide + `
必ず次のJSONだけを返す（説明文やコードフェンスは禁止）:
{"score":整数,"headline":"28文字以内の前向きな一言","bullets":["箇条書き1","箇条書き2","箇条書き3"],"shareText":"X投稿用。スコアと一言とハッシュタグを含め280文字以内"}

bulletsは各40文字以内。shareTextには「婚活偏差値〇〇」「#婚活偏差値診断」を含める。`

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
	out = normalizeResult(out)
	return out, nil
}

func buildUserContent(answers map[string]string) string {
	var b strings.Builder
	b.WriteString("次の設問に対する回答です。valueは選択肢の値。\n\n")
	for _, q := range questions.All() {
		v := answers[q.ID]
		b.WriteString("- ")
		b.WriteString(q.ID)
		b.WriteString(" ")
		b.WriteString(q.Text)
		b.WriteString(" => ")
		b.WriteString(v)
		b.WriteString("\n")
	}
	return b.String()
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

// mockResult はAPIキー無しのローカル確認用（決定的なダミー）。
func mockResult(answers map[string]string) Result {
	sum := 0
	for _, q := range questions.All() {
		v := answers[q.ID]
		switch v {
		case "1":
			sum += 4
		case "2":
			sum += 3
		case "3":
			sum += 2
		case "4":
			sum += 1
		default:
			sum += 2
		}
	}
	// 8問×1〜4 => 8〜32 を 40〜70 にマップ
	score := 40 + (sum-8)*30/(32-8)
	if score < 35 {
		score = 35
	}
	if score > 75 {
		score = 75
	}
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
