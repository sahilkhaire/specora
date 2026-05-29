package specora

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// ResolveEmbedDir returns the first directory that contains manifest.json.
// Checks Config.EmbedDir, SPECORA_EMBED_DIR, then optional candidate paths.
func ResolveEmbedDir(candidates ...string) string {
	if dir := os.Getenv("SPECORA_EMBED_DIR"); dir != "" {
		if hasEmbedManifest(dir) {
			return absPath(dir)
		}
	}
	for _, dir := range candidates {
		if dir == "" {
			continue
		}
		if hasEmbedManifest(dir) {
			return absPath(dir)
		}
	}
	return ""
}

// FindRepoEmbedDir walks up from the working directory looking for dist/embed/latest.
func FindRepoEmbedDir() string {
	if dir := ResolveEmbedDir(); dir != "" {
		return dir
	}

	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}

	for dir := cwd; ; dir = filepath.Dir(dir) {
		candidate := filepath.Join(dir, "dist", "embed", "latest")
		if hasEmbedManifest(candidate) {
			return absPath(candidate)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}
	return ""
}

// EmbedManifestInfo describes a local embed bundle manifest.
type EmbedManifestInfo struct {
	Version string
	BuiltAt string
}

// ReadEmbedManifest reads manifest.json from an embed bundle directory.
func ReadEmbedManifest(dir string) (EmbedManifestInfo, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return EmbedManifestInfo{}, err
	}
	var manifest embedManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return EmbedManifestInfo{}, err
	}
	return EmbedManifestInfo{
		Version: manifest.Version,
		BuiltAt: manifest.BuiltAt,
	}, nil
}

func hasEmbedManifest(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "manifest.json"))
	return err == nil
}

func absPath(dir string) string {
	if abs, err := filepath.Abs(dir); err == nil {
		return abs
	}
	return dir
}
