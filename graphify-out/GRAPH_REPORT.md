# Graph Report - chess  (2026-11-16)

## Corpus Check
- 38 files · ~79,045 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 525 nodes · 1453 edges · 11 communities
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1ba083a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- httpServer.js
- createGameService
- chessUiHelper.test.js
- aiEngine.js
- httpServer.test.js
- steps
- services
- createStockfishAnalyzer
- analysisHelper.test.js
- resolveReviewViewState

## God Nodes (most connected - your core abstractions)
1. `createGameService()` - 59 edges
2. `handleCompanionSnapshot()` - 28 edges
3. `renderApp()` - 27 edges
4. `createHttpServer()` - 25 edges
5. `getViewerColor()` - 24 edges
6. `startTestServer()` - 24 edges
7. `getLanguage()` - 23 edges
8. `bootstrapApp()` - 20 edges
9. `createStockfishAnalyzer()` - 18 edges
10. `t()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `testResolveBotSelection()` --calls--> `resolveBotSelection()`  [EXTRACTED]
  tests/botAndTimeDomain.test.js → src/domain/botProfiles.js
- `startTestServer()` --calls--> `createHttpServer()`  [EXTRACTED]
  tests/companionHttp.test.js → src/server/httpServer.js
- `startTestServer()` --calls--> `createHttpServer()`  [EXTRACTED]
  tests/httpServer.test.js → src/server/httpServer.js
- `testFriendPlayerChatAndBounds()` --calls--> `validateChatMessageInput()`  [EXTRACTED]
  tests/gameService.test.js → src/server/validators.js
- `startTestServer()` --calls--> `createGameService()`  [EXTRACTED]
  tests/companionHttp.test.js → src/service/gameService.js

## Import Cycles
- None detected.

## Communities (11 total, 0 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.06
Nodes (95): appendBoardArrow(), applyIncomingSseGame(), applyLanguage(), applySelectionClasses(), authenticateChatSocket(), bootstrapApp(), cancelActiveAnalysis(), canReviewGame() (+87 more)

### Community 1 - "httpServer.js"
Cohesion: 0.07
Nodes (49): BOT_PROFILES, DIFFICULTY_DEFAULT_BOT, findBotProfile(), listBotProfiles(), resolveBotSelection(), CompanionValidationError, normalizeLastMove(), parseCompanionSnapshot() (+41 more)

### Community 2 - "createGameService"
Cohesion: 0.08
Nodes (70): applyClockAfterMove(), buildClockSnapshot(), buildSnapshot(), createClockState(), createGameService(), addRoomListener(), appendChatEntry(), appendSystemChat() (+62 more)

### Community 4 - "chessUiHelper.test.js"
Cohesion: 0.11
Nodes (36): renderAvatarBubbles(), showAvatarBubble(), applyOptimisticMove(), canInteractWithBoard(), canSendMatchChat(), CAPTURE_SORT_ORDER, clampBubblePosition(), computeCapturedMaterial() (+28 more)

### Community 5 - "aiEngine.js"
Cohesion: 0.08
Nodes (33): dependencies, chess.js@^1.4.0, stockfish@^19.0.1, ws@^8.22.2, description, name, private, scripts (+25 more)

### Community 6 - "httpServer.test.js"
Cohesion: 0.11
Nodes (27): openSseClient(), openWsClient(), rawHttpGet(), REAL_PUBLIC_DIR, REAL_STOCKFISH_DIR, startTestServer(), testCreateAndGetGameEndpoint(), testCreateGameRejectsInvalidPayload() (+19 more)

### Community 7 - "steps"
Cohesion: 0.10
Nodes (19): concurrency, cancel-in-progress, group, jobs, verify, name, on, pull_request (+11 more)

### Community 9 - "services"
Cohesion: 0.17
Nodes (11): services, autoDeployTrigger, branch, buildCommand, healthCheckPath, name, plan, region (+3 more)

### Community 11 - "createStockfishAnalyzer"
Cohesion: 0.25
Nodes (16): parseMultiPvIndex(), parseUciInfoLine(), summarizeGameAnalysis(), createAbortError(), createStockfishAnalyzer(), analyzeGame(), analyzePosition(), dispose() (+8 more)

### Community 12 - "analysisHelper.test.js"
Cohesion: 0.06
Nodes (81): CLASSIFICATION_KEYS, classifyMove(), computeConsecutiveBestMovesStreak(), computeMoveAccuracy(), DEFAULT_CONSECUTIVE_BEST_MOVES_THRESHOLD, detectBrilliantMove(), detectGreatMove(), evalToWinPercent() (+73 more)

### Community 14 - "resolveReviewViewState"
Cohesion: 0.10
Nodes (22): DEFAULT_LANGUAGE, initI18n(), resolveStorage(), setLanguage(), STORAGE_KEY, SUPPORTED_LANGUAGES, TRANSLATIONS, FILES (+14 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createGameService()` connect `createGameService` to `httpServer.js`, `resolveReviewViewState`, `httpServer.test.js`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `createGameService()` (e.g. with `applyPlayerMove()` and `createGame()`) actually correct?**
  _`createGameService()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.060399917542774684 - nodes in this community are weakly interconnected._
- **Why does `chess.js` connect `aiEngine.js` to `httpServer.js`, `createGameService`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `httpServer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07115384615384615 - nodes in this community are weakly interconnected._
- **Why does `createStockfishAnalyzer()` connect `createStockfishAnalyzer` to `app.js`, `analysisHelper.test.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `createGameService` be split into smaller, more focused modules?**
  _Cohesion score 0.07592407592407592 - nodes in this community are weakly interconnected._