package specora

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config configures the Specora docs http.Handler.
type Config struct {
	SpecPath  string
	MountPath string
}

// Handler serves a minimal docs shell and the OpenAPI spec JSON.
func Handler(cfg Config) http.Handler {
	mount := strings.TrimSuffix(cfg.MountPath, "/")
	if mount == "" {
		mount = "/api-docs"
	}

	mux := http.NewServeMux()

	mux.HandleFunc(mount+"/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		spec, err := readSpec(cfg.SpecPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(spec)
	})

	mux.HandleFunc(mount+"/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!DOCTYPE html><html><body>
<p>Specora Go mount active. Wire @specora/node for full CDN UI.</p>
<p><a href="` + mount + `/openapi.json">OpenAPI spec</a></p>
<script>window.__SPECORA_EMBED__={surface:"embed",specUrl:"` + mount + `/openapi.json",mountPath:"` + mount + `"};</script>
</body></html>`))
	})

	mux.HandleFunc(mount, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, mount+"/", http.StatusFound)
	})

	return mux
}

func readSpec(path string) (map[string]interface{}, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "{") {
		var out map[string]interface{}
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, err
		}
		return out, nil
	}
	var out map[string]interface{}
	if err := yaml.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
