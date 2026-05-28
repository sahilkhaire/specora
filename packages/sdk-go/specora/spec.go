package specora

import (
	"encoding/json"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

func readSpec(path string) (map[string]any, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

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
