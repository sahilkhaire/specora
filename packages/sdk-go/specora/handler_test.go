package specora_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

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
