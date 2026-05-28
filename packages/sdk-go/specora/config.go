package specora

// Config configures the Specora docs http.Handler.
type Config struct {
	// SpecPath is the path to openapi.yaml or swagger.json on disk.
	SpecPath string

	// MountPath is the URL prefix where docs are served (default /api-docs).
	MountPath string

	// EmbedDir loads the docs UI from a local directory (e.g. dist/embed/latest from
	// `npm run publish:embed-cdn`). Overrides CDN when set. Also reads SPECORA_EMBED_DIR.
	EmbedDir string

	// CdnBase is the Specora embed CDN root (default https://specora.varcore.dev/embed).
	CdnBase string

	// Version is the embed bundle version: "latest" or a semver like "0.1.0".
	Version string

	// PublicFilter controls which operations are shown: tag:public, extension, no-security, or all.
	PublicFilter string

	// IncludeAll shows every operation regardless of public filter.
	IncludeAll bool
}

func (c Config) mount() string {
	if c.MountPath == "" {
		return "/api-docs"
	}
	return trimSuffixSlash(c.MountPath)
}

func (c Config) cdnBase() string {
	if c.CdnBase == "" {
		return "https://specora.varcore.dev/embed"
	}
	return trimSuffixSlash(c.CdnBase)
}

func (c Config) version() string {
	if c.Version == "" {
		return "latest"
	}
	return c.Version
}
