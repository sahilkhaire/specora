package specora

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type embedManifest struct {
	Version  string `json:"version"`
	IndexHTML string `json:"indexHtml"`
}

type embedUI struct {
	once sync.Once
	html string
	err  error
}

func (c Config) specURL(mount string) string {
	return mount + "/openapi.json"
}

func (c Config) fetchEmbedHTML(mount string) (string, error) {
	base := c.cdnBase()
	version := c.version()
	manifestURL := fmt.Sprintf("%s/latest/manifest.json", base)
	if version != "latest" {
		manifestURL = fmt.Sprintf("%s/v%s/manifest.json", base, strings.TrimPrefix(version, "v"))
	}

	client := &http.Client{Timeout: 30 * time.Second}

	manifestResp, err := client.Get(manifestURL)
	if err != nil {
		return "", fmt.Errorf("fetch embed manifest: %w", err)
	}
	defer manifestResp.Body.Close()

	if manifestResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("embed manifest HTTP %d from %s", manifestResp.StatusCode, manifestURL)
	}

	var manifest embedManifest
	if err := json.NewDecoder(manifestResp.Body).Decode(&manifest); err != nil {
		return "", fmt.Errorf("decode embed manifest: %w", err)
	}

	indexPath := manifest.IndexHTML
	if indexPath == "" {
		indexPath = "index.html"
	}

	indexPrefix := fmt.Sprintf("%s/latest", base)
	if version != "latest" {
		indexPrefix = fmt.Sprintf("%s/v%s", base, strings.TrimPrefix(version, "v"))
	}

	indexResp, err := client.Get(indexPrefix + "/" + indexPath)
	if err != nil {
		return "", fmt.Errorf("fetch embed index: %w", err)
	}
	defer indexResp.Body.Close()

	if indexResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("embed index HTTP %d", indexResp.StatusCode)
	}

	indexHTML, err := io.ReadAll(indexResp.Body)
	if err != nil {
		return "", fmt.Errorf("read embed index: %w", err)
	}

	cfg := map[string]any{
		"surface":      "embed",
		"specUrl":      c.specURL(mount),
		"mountPath":    mount,
		"publicFilter": c.PublicFilter,
		"includeAll":   c.IncludeAll,
	}
	if c.PublicFilter == "" && !c.IncludeAll {
		cfg["publicFilter"] = "tag:public"
	}

	cfgJSON, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}

	injection := fmt.Sprintf("<script>window.__SPECORA_EMBED__=%s;</script>", cfgJSON)
	html := string(indexHTML)
	if strings.Contains(html, "</head>") {
		return strings.Replace(html, "</head>", injection+"</head>", 1), nil
	}
	return injection + html, nil
}

func (ui *embedUI) load(cfg Config, mount string) {
	ui.once.Do(func() {
		ui.html, ui.err = cfg.fetchEmbedHTML(mount)
	})
}
