// Example: run a small server with Specora docs at /api-docs/
//
// From the monorepo root, build the embed UI once:
//
//	npm run publish:embed-cdn
//
// Then:
//
//	go run ./example/main.go
//	go run ./example/main.go https://petstore.swagger.io/v2/swagger.json
//
// Open http://localhost:8080/api-docs/
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func main() {
	specPath := filepath.Join("..", "..", "..", "packages", "cli", "tests", "fixtures", "valid-openapi.yaml")
	if len(os.Args) > 1 {
		specPath = os.Args[1]
	}

	embedDir := specora.ResolveEmbedDir(
		filepath.Join("..", "..", "dist", "embed", "latest"),
		filepath.Join("..", "..", "..", "dist", "embed", "latest"),
		filepath.Join("dist", "embed", "latest"),
	)

	cfg := specora.Config{
		SpecPath:  specPath,
		MountPath: "/api-docs",
		EmbedDir:  embedDir,
	}
	if embedDir == "" {
		log.Print("No local embed bundle found; using CDN (requires https://specora.varcore.dev/embed/latest to be deployed).")
		log.Print("For local dev, from repo root: npm run publish:embed-cdn")
		log.Print("Then re-run, or set SPECORA_EMBED_DIR=dist/embed/latest")
	} else {
		log.Printf("Using local embed bundle: %s", embedDir)
	}

	mux := http.NewServeMux()
	mux.Handle("/api-docs/", specora.Handler(cfg))

	addr := ":8080"
	log.Printf("Specora Go example listening on http://localhost%s/api-docs/", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
