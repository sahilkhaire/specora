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
//	PORT=8081 go run ./example/main.go
//
// Open http://localhost:8080/api-docs/ (or the PORT you set).
package main

import (
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func main() {
	specPath := filepath.Join("..", "..", "..", "packages", "cli", "tests", "fixtures", "valid-openapi.yaml")
	args := os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		specPath = args[0]
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("Specora Go example listening on http://localhost:%s/api-docs/", port)

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		if isAddrInUse(err) {
			log.Fatalf(
				"port %s is already in use (often a previous example still running). "+
					"Stop it with: lsof -ti :%s | xargs kill\nOr use another port: PORT=8081 go run ./example/main.go",
				port,
				port,
			)
		}
		log.Fatal(err)
	}
	log.Fatal(http.Serve(ln, mux))
}

func isAddrInUse(err error) bool {
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		var sysErr syscall.Errno
		if errors.As(opErr.Err, &sysErr) {
			return sysErr == syscall.EADDRINUSE
		}
	}
	return false
}
