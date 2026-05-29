package specora

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func (c Config) embedDir() string {
	if c.EmbedDir != "" {
		return c.EmbedDir
	}
	if dir := os.Getenv("SPECORA_EMBED_DIR"); dir != "" {
		return dir
	}
	return ""
}

func (c Config) loadEmbedFromDir(dir, mount string) (string, error) {
	manifestPath := filepath.Join(dir, "manifest.json")
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return "", fmt.Errorf("read embed manifest %s: %w", manifestPath, err)
	}

	var manifest embedManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return "", fmt.Errorf("parse embed manifest %s: %w", manifestPath, err)
	}

	indexName := manifest.IndexHTML
	if indexName == "" {
		indexName = "index.html"
	}

	indexPath := filepath.Join(dir, indexName)
	indexHTML, err := os.ReadFile(indexPath)
	if err != nil {
		return "", fmt.Errorf("read embed index %s: %w", indexPath, err)
	}

	return injectEmbedConfig(string(indexHTML), c, mount)
}

func injectEmbedConfig(indexHTML string, c Config, mount string) (string, error) {
	specURL := c.specURL(mount)
	cfg := map[string]any{
		"surface":         "embed",
		"specUrl":         specURL,
		"mountPath":       mount,
		"publicFilter":    c.PublicFilter,
		"includeAll":      c.IncludeAll,
		"downloadJsonUrl": c.downloadJSONURL(mount),
	}
	if c.PublicFilter == "" && !c.IncludeAll {
		cfg["publicFilter"] = "tag:public"
	}
	if yamlURL := c.downloadYAMLURL(mount); yamlURL != "" {
		cfg["downloadYamlUrl"] = yamlURL
	}

	cfgJSON, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}

	injection := fmt.Sprintf("<script>window.__SPECORA_EMBED__=%s;</script>", cfgJSON)
	html := rewriteEmbedAssetURLs(indexHTML, mount, c)
	if strings.Contains(html, "</head>") {
		return strings.Replace(html, "</head>", injection+"</head>", 1), nil
	}
	return injection + html, nil
}
