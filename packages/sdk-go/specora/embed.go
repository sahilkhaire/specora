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
	Version   string `json:"version"`
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
	if dir := c.embedDir(); dir != "" {
		return c.loadEmbedFromDir(dir, mount)
	}
	return c.fetchEmbedHTMLFromCDN(mount)
}

func (c Config) fetchEmbedHTMLFromCDN(mount string) (string, error) {
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

	body, err := io.ReadAll(manifestResp.Body)
	if err != nil {
		return "", fmt.Errorf("read embed manifest: %w", err)
	}

	if manifestResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("embed manifest HTTP %d from %s", manifestResp.StatusCode, manifestURL)
	}

	if looksLikeHTML(body) {
		return "", fmt.Errorf(
			"embed manifest at %s returned HTML instead of JSON; the embed bundle is likely not deployed. "+
				"Run `npm run publish:embed-cdn` from the Specora repo and upload dist/embed/ to %s, "+
				"or set Config.EmbedDir / SPECORA_EMBED_DIR to a local path (e.g. dist/embed/latest)",
			manifestURL,
			base,
		)
	}

	var manifest embedManifest
	if err := json.Unmarshal(body, &manifest); err != nil {
		return "", fmt.Errorf("decode embed manifest from %s: %w", manifestURL, err)
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

	return injectEmbedConfig(string(indexHTML), c, mount)
}

func looksLikeHTML(body []byte) bool {
	trimmed := strings.TrimSpace(string(body))
	return strings.HasPrefix(trimmed, "<") || strings.HasPrefix(strings.ToLower(trimmed), "<!doctype")
}

func (ui *embedUI) load(cfg Config, mount string) {
	ui.once.Do(func() {
		ui.html, ui.err = cfg.fetchEmbedHTML(mount)
	})
}
