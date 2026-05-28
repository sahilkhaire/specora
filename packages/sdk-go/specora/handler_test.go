package specora_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func TestHandlerEmbedFromDir(t *testing.T) {
	dir := t.TempDir()
	manifest := `{"version":"0.1.0","indexHtml":"index.html"}`
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	indexHTML := `<!DOCTYPE html><html><head><script src="/assets/index.js"></script><link href="/assets/index.css" rel="stylesheet"></head><body>embed</body></html>`
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(indexHTML), 0o600); err != nil {
		t.Fatal(err)
	}

	specPath := filepath.Join(dir, "openapi.json")
	if err := os.WriteFile(specPath, []byte(`{
		"openapi": "3.0.3",
		"info": {"title": "EmbedDir", "version": "1.0.0"},
		"paths": {}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}

	handler := specora.Handler(specora.Config{
		SpecPath:  specPath,
		MountPath: "/api-docs",
		EmbedDir:  dir,
	})

	req := httptest.NewRequest(http.MethodGet, "/api-docs/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, "__SPECORA_EMBED__") {
		t.Fatalf("expected embed config injection, got %s", body)
	}
	if !contains(body, `/api-docs/_assets/`) {
		t.Fatalf("expected rewritten asset URLs under mount, got %s", body)
	}
	if contains(body, `src="/assets/`) {
		t.Fatalf("expected no root-absolute /assets/ paths, got %s", body)
	}
}

func TestHandlerOpenAPI(t *testing.T) {
	dir := t.TempDir()
	specPath := filepath.Join(dir, "openapi.json")
	err := os.WriteFile(specPath, []byte(`{
		"openapi": "3.0.3",
		"info": {"title": "Test", "version": "1.0.0"},
		"paths": {}
	}`), 0o600)
	if err != nil {
		t.Fatal(err)
	}

	handler := specora.Handler(specora.Config{
		SpecPath:  specPath,
		MountPath: "/api-docs",
	})

	req := httptest.NewRequest(http.MethodGet, "/api-docs/openapi.json", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !contains(rec.Body.String(), "Test") {
		t.Fatalf("expected spec title in response, got %s", rec.Body.String())
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
