package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"

	"konkatsu-diagnosis/internal/llm"
	"konkatsu-diagnosis/internal/questions"
)

// Handler はAPIハンドラ。
type Handler struct{}

type diagnoseReq struct {
	Answers map[string]string `json:"answers"`
}

// Register はルートを登録する。
func (h *Handler) Register(r chi.Router) {
	r.Get("/api/questions", h.GetQuestions)
	r.Post("/api/diagnose", h.PostDiagnose)
	r.Get("/api/share/{token}", h.GetShareJSON)
}

// GetQuestions は設問一覧（単一ソースオブトゥルース）。
func (h *Handler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(questions.All())
}

// PostDiagnose はLLM診断API。
func (h *Handler) PostDiagnose(w http.ResponseWriter, r *http.Request) {
	ct := r.Header.Get("Content-Type")
	var req diagnoseReq
	if strings.Contains(ct, "application/json") {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
	} else {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		req.Answers = map[string]string{}
		for k, v := range r.PostForm {
			if len(v) > 0 {
				req.Answers[k] = v[0]
			}
		}
	}

	for _, q := range questions.All() {
		if strings.TrimSpace(req.Answers[q.ID]) == "" {
			http.Error(w, "missing answers", http.StatusBadRequest)
			return
		}
	}

	res, err := llm.Diagnose(r.Context(), req.Answers)
	if err != nil {
		log.Printf("diagnose: %v", err)
		http.Error(w, "diagnosis failed", http.StatusInternalServerError)
		return
	}

	payload := sharePayload{Score: res.Score, Headline: res.Headline}
	token, err := encodeShareToken(payload)
	if err != nil {
		http.Error(w, "encode failed", http.StatusInternalServerError)
		return
	}

	out := struct {
		llm.Result
		SharePath string `json:"sharePath"`
	}{
		Result:    res,
		SharePath: "/share/" + token,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

type sharePayload struct {
	Score    int    `json:"score"`
	Headline string `json:"headline"`
}

// shareJSONResponse はNext.jsのgenerateMetadata用。
type shareJSONResponse struct {
	Score    int    `json:"score"`
	Headline string `json:"headline"`
}

// GetShareJSON はトークン検証済みの共有用メタ情報。
func (h *Handler) GetShareJSON(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	payload, err := decodeShareToken(token)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(shareJSONResponse{
		Score:    payload.Score,
		Headline: payload.Headline,
	})
}

func encodeShareToken(p sharePayload) (string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func decodeShareToken(token string) (sharePayload, error) {
	var p sharePayload
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return p, err
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return p, err
	}
	if p.Score < 35 || p.Score > 75 {
		return p, errors.New("invalid payload")
	}
	return p, nil
}

// BuildTwitterIntentURL はX投稿用URLを組み立てる（エスケープ済み）。
func BuildTwitterIntentURL(shareText, pageURL string) string {
	q := url.Values{}
	q.Set("text", shareText)
	if strings.TrimSpace(pageURL) != "" {
		q.Set("url", pageURL)
	}
	return "https://twitter.com/intent/tweet?" + q.Encode()
}
