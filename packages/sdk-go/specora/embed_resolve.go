package specora

import (
	"os"
	"path/filepath"
)

// ResolveEmbedDir returns the first directory that contains manifest.json.
// Checks Config.EmbedDir, SPECORA_EMBED_DIR, then optional candidate paths.
func ResolveEmbedDir(candidates ...string) string {
	if dir := os.Getenv("SPECORA_EMBED_DIR"); dir != "" {
		return dir
	}
	for _, dir := range candidates {
		if dir == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(dir, "manifest.json")); err == nil {
			if abs, err := filepath.Abs(dir); err == nil {
				return abs
			}
			return dir
		}
	}
	return ""
}
