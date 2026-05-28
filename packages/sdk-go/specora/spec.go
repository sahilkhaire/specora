package specora

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

func readSpec(path string) (map[string]any, error) {
	trimmed := strings.TrimSpace(path)
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return readSpecFromURL(trimmed)
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	return parseSpecBytes(raw)
}

func readSpecFromURL(specURL string) (map[string]any, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(specURL)
	if err != nil {
		return nil, fmt.Errorf("fetch spec from %s: %w", specURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch spec from %s: HTTP %d", specURL, resp.StatusCode)
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read spec from %s: %w", specURL, err)
	}

	return parseSpecBytes(raw)
}

func parseSpecBytes(raw []byte) (map[string]any, error) {
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "{") {
		var out map[string]any
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, err
		}
		return out, nil
	}

	var out map[string]any
	if err := yaml.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func trimSuffixSlash(path string) string {
	return strings.TrimSuffix(path, "/")
}
