package specora

import (
	"fmt"
	"path/filepath"
	"strings"
)

// rewriteEmbedAssetURLs points /assets/* at the CDN or at {mount}/_assets/ when using EmbedDir.
func rewriteEmbedAssetURLs(html, mount string, c Config) string {
	if c.embedDir() != "" {
		localPrefix := mount + "/_assets/"
		html = strings.ReplaceAll(html, `src="/assets/`, `src="`+localPrefix)
		html = strings.ReplaceAll(html, `href="/assets/`, `href="`+localPrefix)
		return html
	}

	prefix := c.cdnVersionedBase() + "/"
	html = strings.ReplaceAll(html, `src="/assets/`, `src="`+prefix+`assets/`)
	html = strings.ReplaceAll(html, `href="/assets/`, `href="`+prefix+`assets/`)
	return html
}

func (c Config) cdnVersionedBase() string {
	base := c.cdnBase()
	version := c.version()
	if version == "latest" {
		return base + "/latest"
	}
	return fmt.Sprintf("%s/v%s", base, strings.TrimPrefix(version, "v"))
}

func (c Config) localAssetsDir() string {
	dir := c.embedDir()
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, "assets")
}
