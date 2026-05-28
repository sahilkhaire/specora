// Example: run a small server with Specora docs at /api-docs/
//
//	go run ./example/main.go
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

	mux := http.NewServeMux()
	mux.Handle("/api-docs/", specora.Handler(specora.Config{
		SpecPath:  specPath,
		MountPath: "/api-docs",
	}))

	addr := ":8080"
	log.Printf("Specora Go example listening on http://localhost%s/api-docs/", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
