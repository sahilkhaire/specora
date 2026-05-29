package specora

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
)

// Handler returns an http.Handler that serves Specora API docs at MountPath.
//
// It exposes:
//   - GET {MountPath}/           — interactive docs UI (loaded from Specora CDN)
//   - GET {MountPath}/openapi.json — OpenAPI document read from SpecPath
//
// Mount the handler on your router, for example:
//
//	http.Handle("/api-docs/", specora.Handler(specora.Config{SpecPath: "./openapi.yaml"}))
func Handler(cfg Config) http.Handler {
	mount := cfg.mount()
	var specCache map[string]any
	var specMu sync.RWMutex
	ui := &embedUI{}

	mux := http.NewServeMux()

	serveSpec := func(w http.ResponseWriter, r *http.Request) {
		specMu.RLock()
		cached := specCache
		specMu.RUnlock()

		if cached == nil {
			spec, err := readSpec(cfg.SpecPath)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			specMu.Lock()
			specCache = spec
			cached = spec
			specMu.Unlock()
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cached)
	}

	mux.HandleFunc(mount+"/openapi.json", serveSpec)

	if yamlURL := cfg.downloadYAMLURL(mount); yamlURL != "" && !isRemoteSpecPath(cfg.SpecPath) {
		mux.HandleFunc(mount+"/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
			raw, err := os.ReadFile(cfg.SpecPath)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = w.Write(raw)
		})
	}

	if assetsDir := cfg.localAssetsDir(); assetsDir != "" {
		if info, err := os.Stat(assetsDir); err == nil && info.IsDir() {
			mux.Handle(
				mount+"/_assets/",
				noCache(http.StripPrefix(mount+"/_assets/", http.FileServer(http.Dir(assetsDir)))),
			)
		}
	}

	mux.HandleFunc(mount+"/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != mount+"/" && r.URL.Path != mount {
			http.NotFound(w, r)
			return
		}

		ui.load(cfg, mount)
		if ui.err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(fallbackHTML(mount, ui.err)))
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if cfg.embedDir() != "" {
			w.Header().Set("Cache-Control", "no-store")
		}
		_, _ = w.Write([]byte(ui.html))
	})

	mux.HandleFunc(mount, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == mount {
			http.Redirect(w, r, mount+"/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})

	return mux
}

func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func isRemoteSpecPath(path string) bool {
	trimmed := strings.TrimSpace(path)
	return strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://")
}

func fallbackHTML(mount string, err error) string {
	msg := "Specora embed could not load from CDN. Check network access or set CdnBase."
	if err != nil {
		msg = err.Error()
	}
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Specora</title></head><body>
<p>` + msg + `</p>
<p><a href="` + mount + `/openapi.json">OpenAPI JSON</a></p>
</body></html>`
}
