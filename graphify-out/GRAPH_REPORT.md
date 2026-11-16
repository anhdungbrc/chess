# Graph Report - chess  (2026-11-16)

## Corpus Check
- 38 files · ~77,014 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 523 nodes · 1447 edges · 16 communities
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f3341ef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- httpServer.js
- createGameService
- companionUiHelper.js
- chessUiHelper.test.js
- aiEngine.js
- httpServer.test.js
- steps
- resolveReviewViewState
- services
- renderApp
- analysisHelper.test.js
- getViewerColor
- renderChatPanel
- handlePointerUp
- i18n.js

## God Nodes (most connected - your core abstractions)
1. `createGameService()` - 59 edges
2. `handleCompanionSnapshot()` - 27 edges
3. `renderApp()` - 27 edges
4. `createHttpServer()` - 25 edges
5. `getViewerColor()` - 24 edges
6. `startTestServer()` - 24 edges
7. `getLanguage()` - 23 edges
8. `bootstrapApp()` - 20 edges
9. `createStockfishAnalyzer()` - 18 edges
10. `t()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `testFormatEvalScore()` --calls--> `formatEvalScore()`  [EXTRACTED]
  tests/analysisHelper.test.js → public/analysisHelper.js
- `testResolveBotSelection()` --calls--> `resolveBotSelection()`  [EXTRACTED]
  tests/botAndTimeDomain.test.js → src/domain/botProfiles.js
- `startTestServer()` --calls--> `createHttpServer()`  [EXTRACTED]
  tests/httpServer.test.js → src/server/httpServer.js
- `testFriendPlayerChatAndBounds()` --calls--> `validateChatMessageInput()`  [EXTRACTED]
  tests/gameService.test.js → src/server/validators.js
- `startTestServer()` --calls--> `createGameService()`  [EXTRACTED]
  tests/companionHttp.test.js → src/service/gameService.js

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.11
Nodes (26): autoCollapseMobileNavOnAction(), closePromotionModal(), createHistoryMoveCell(), dismissGameOverModal(), DRAW_REASON_LABELS, elements, FALLBACK_BOTS, FALLBACK_TIME_CONTROLS (+18 more)

### Community 1 - "httpServer.js"
Cohesion: 0.06
Nodes (53): BOT_PROFILES, DIFFICULTY_DEFAULT_BOT, findBotProfile(), listBotProfiles(), resolveBotSelection(), CompanionValidationError, normalizeLastMove(), parseCompanionSnapshot() (+45 more)

### Community 2 - "createGameService"
Cohesion: 0.08
Nodes (70): applyClockAfterMove(), buildClockSnapshot(), buildSnapshot(), createClockState(), createGameService(), addRoomListener(), appendChatEntry(), appendSystemChat() (+62 more)

### Community 3 - "companionUiHelper.js"
Cohesion: 0.12
Nodes (39): formatEvalScore(), copyCompanionRelayScript(), handleCompanionSnapshot(), renderAnalysisPanel(), renderCompanionBestMoveArrow(), renderCompanionBoard(), renderCompanionEval(), renderCompanionMoveReview() (+31 more)

### Community 4 - "chessUiHelper.test.js"
Cohesion: 0.12
Nodes (32): renderAvatarBubbles(), showAvatarBubble(), applyOptimisticMove(), canSendMatchChat(), CAPTURE_SORT_ORDER, clampBubblePosition(), computeCapturedMaterial(), FILES (+24 more)

### Community 5 - "aiEngine.js"
Cohesion: 0.08
Nodes (33): dependencies, chess.js@^1.4.0, stockfish@^19.0.1, ws@^8.22.2, description, name, private, scripts (+25 more)

### Community 6 - "httpServer.test.js"
Cohesion: 0.11
Nodes (27): openSseClient(), openWsClient(), rawHttpGet(), REAL_PUBLIC_DIR, REAL_STOCKFISH_DIR, startTestServer(), testCreateAndGetGameEndpoint(), testCreateGameRejectsInvalidPayload() (+19 more)

### Community 7 - "steps"
Cohesion: 0.10
Nodes (19): concurrency, cancel-in-progress, group, jobs, verify, name, on, pull_request (+11 more)

### Community 8 - "resolveReviewViewState"
Cohesion: 0.31
Nodes (11): FILES, formatReviewMoveLabel(), parseFenBoard(), PIECE_TYPES, resolveReviewViewState(), createSnapshotFixture(), testFormatReviewMoveLabel(), testParseFenBoardRejectsMalformedFen() (+3 more)

### Community 9 - "services"
Cohesion: 0.17
Nodes (11): services, autoDeployTrigger, branch, buildCommand, healthCheckPath, name, plan, region (+3 more)

### Community 10 - "renderApp"
Cohesion: 0.16
Nodes (25): applyLanguage(), bootstrapApp(), canReviewGame(), copyInviteLink(), describeGameOutcome(), formatStatusBanner(), getViewerColor(), loadSeatSession() (+17 more)

### Community 11 - "analysisHelper.test.js"
Cohesion: 0.08
Nodes (56): CLASSIFICATION_KEYS, classifyMove(), computeConsecutiveBestMovesStreak(), computeMoveAccuracy(), DEFAULT_CONSECUTIVE_BEST_MOVES_THRESHOLD, detectBrilliantMove(), detectGreatMove(), evalToWinPercent() (+48 more)

### Community 12 - "getViewerColor"
Cohesion: 0.20
Nodes (23): applyIncomingSseGame(), authenticateChatSocket(), cancelActiveAnalysis(), clearAvatarBubbles(), connectChatSocket(), connectGameEvents(), disconnectChatSocket(), disconnectGameEvents() (+15 more)

### Community 13 - "renderChatPanel"
Cohesion: 0.29
Nodes (7): handleIncomingChatMessage(), renderChatPanel(), renderMessageListInto(), setPlaySubtab(), setupMobileChatFabDrag(), toggleMobileChat(), triggerMobileChatFabPulse()

### Community 14 - "handlePointerUp"
Cohesion: 0.14
Nodes (18): appendBoardArrow(), applySelectionClasses(), clearDragState(), getLegalMovesFromSquare(), handleBoardPointerDown(), handlePointerMove(), handlePointerUp(), handleSquareSelectOrMove() (+10 more)

### Community 16 - "i18n.js"
Cohesion: 0.36
Nodes (7): DEFAULT_LANGUAGE, initI18n(), resolveStorage(), setLanguage(), STORAGE_KEY, SUPPORTED_LANGUAGES, TRANSLATIONS

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createGameService()` connect `createGameService` to `httpServer.js`, `httpServer.test.js`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `createGameService()` (e.g. with `applyPlayerMove()` and `createGame()`) actually correct?**
  _`createGameService()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11083743842364532 - nodes in this community are weakly interconnected._
- **Why does `chess.js` connect `aiEngine.js` to `httpServer.js`, `createGameService`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `httpServer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05827505827505827 - nodes in this community are weakly interconnected._
- **Why does `createStockfishAnalyzer()` connect `analysisHelper.test.js` to `app.js`, `companionUiHelper.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `createGameService` be split into smaller, more focused modules?**
  _Cohesion score 0.07592407592407592 - nodes in this community are weakly interconnected._