package specora_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func TestProductionCDN(t *testing.T) {
	if os.Getenv("SPECORA_CDN_INTEGRATION") != "1" {
		t.Skip("set SPECORA_CDN_INTEGRATION=1 to hit production CDN")
	}

	dir := t.TempDir()
	specPath := dir + "/openapi.json"
	if err := os.WriteFile(specPath, []byte(`{
		"openapi": "3.0.3",
		"info": {"title": "CDN", "version": "1.0.0"},
		"paths": {}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}

	handler := specora.Handler(specora.Config{
		SpecPath:  specPath,
		MountPath: "/api-docs",
		EmbedDir:  "",
		CdnBase:   "https://specora.varcore.dev/embed",
	})

	req := httptest.NewRequest(http.MethodGet, "/api-docs/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, "specora.varcore.dev/embed/latest/assets/") {
		t.Fatalf("expected CDN asset URLs in HTML, got: %s", body[:min(400, len(body))])
	}
	if !contains(body, "__SPECORA_EMBED__") {
		snippet := body
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}
		t.Fatalf("expected embed UI, got: %s", snippet)
	}
}
