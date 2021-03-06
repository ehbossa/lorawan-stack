// Copyright © 2020 The Things Network Foundation, The Things Industries B.V.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package webmiddleware provides middleware for http Handlers.
package webmiddleware

import "net/http"

// MiddlewareFunc is a function that acts as middleware for http Handlers.
type MiddlewareFunc func(next http.Handler) http.Handler

// Chain returns a http.Handler that chains the middleware onion-style around the handler.
func Chain(middlewares []MiddlewareFunc, handler http.Handler) http.Handler {
	for _, mw := range middlewares {
		handler = mw(handler)
	}
	return handler
}
