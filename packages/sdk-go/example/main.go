// Example: run a small server with Specora docs at /api-docs/
//
// From the monorepo root, build the embed UI after web changes:
//
//	npm run publish:embed-cdn
//
// Then (from packages/sdk-go or repo root):
//
//	go run ./example/main.go
//	go run ./example/main.go https://petstore.swagger.io/v2/swagger.json
//	PORT=8081 go run ./example/main.go
//
// Open http://localhost:8080/api-docs/ (or the PORT you set).
// Restart the Go server after rebuilding the embed bundle.
package main

import (
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"syscall"

	"github.com/sahilkhaire/specora/packages/sdk-go/specora"
)

func main() {
	specPath := "../../../packages/cli/tests/fixtures/valid-openapi.yaml"
	args := os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		specPath = args[0]
	}

	embedDir := specora.FindRepoEmbedDir()

	cfg := specora.Config{
		SpecPath:   specPath,
		MountPath:  "/api-docs",
		EmbedDir:   embedDir,
		IncludeAll: true,
	}
	if embedDir == "" {
		log.Print("No local embed bundle found; using CDN (https://specora.varcore.dev/embed/latest).")
		log.Print("That CDN build may be older than your local web changes.")
		log.Print("From repo root run: npm run publish:embed-cdn")
		log.Print("Then restart this server, or set SPECORA_EMBED_DIR=/path/to/dist/embed/latest")
	} else {
		if info, err := specora.ReadEmbedManifest(embedDir); err == nil {
			if info.BuiltAt != "" {
				log.Printf("Using local embed bundle: %s (built %s, v%s)", embedDir, info.BuiltAt, info.Version)
			} else {
				log.Printf("Using local embed bundle: %s (v%s)", embedDir, info.Version)
			}
		} else {
			log.Printf("Using local embed bundle: %s", embedDir)
		}
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
