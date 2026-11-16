# Graph Report - chess  (2026-11-16)

## Corpus Check
- 38 files · ~81,075 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 540 nodes · 1485 edges · 15 communities
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c631629`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- httpServer.js
- createGameService
- bootstrapApp
- chessUiHelper.test.js
- aiEngine.js
- httpServer.test.js
- steps
- ref_node_assert
- services
- renderApp
- analysisHelper.test.js
- handleCompanionSnapshot
- handlePointerUp
- i18n.js

## God Nodes (most connected - your core abstractions)
1. `createGameService()` - 59 edges
2. `handleCompanionSnapshot()` - 28 edges
3. `renderApp()` - 27 edges
4. `createHttpServer()` - 26 edges
5. `getViewerColor()` - 24 edges
6. `getLanguage()` - 24 edges
7. `startTestServer()` - 24 edges
8. `bootstrapApp()` - 21 edges
9. `createStockfishAnalyzer()` - 18 edges
10. `t()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `testFormatEvalScore()` --calls--> `formatEvalScore()`  [EXTRACTED]
  tests/analysisHelper.test.js → public/analysisHelper.js
- `testBrilliantGreatBadges()` --calls--> `getClassificationBadgeInfo()`  [EXTRACTED]
  tests/analysisHelper.test.js → public/chessAssets.js
- `testClassificationBadgeMetadata()` --calls--> `getClassificationBadgeInfo()`  [EXTRACTED]
  tests/analysisHelper.test.js → public/chessAssets.js
- `testCanInteractWithBoard()` --calls--> `canInteractWithBoard()`  [EXTRACTED]
  tests/chessUiHelper.test.js → public/chessUiHelper.js
- `testResolveBotSelection()` --calls--> `resolveBotSelection()`  [EXTRACTED]
  tests/botAndTimeDomain.test.js → src/domain/botProfiles.js

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.10
Nodes (31): autoCollapseMobileNavOnAction(), createHistoryMoveCell(), DRAW_REASON_LABELS, elements, FALLBACK_BOTS, FALLBACK_TIME_CONTROLS, FILES, getActiveAnalysis() (+23 more)

### Community 1 - "httpServer.js"
Cohesion: 0.07
Nodes (54): BOT_PROFILES, DIFFICULTY_DEFAULT_BOT, findBotProfile(), listBotProfiles(), resolveBotSelection(), CompanionValidationError, MAX_AUTO_MOVE_DELAY_MS, MAX_RANDOM_AUTO_MOVE_DELAY_MS (+46 more)

### Community 2 - "createGameService"
Cohesion: 0.08
Nodes (70): applyClockAfterMove(), buildClockSnapshot(), buildSnapshot(), createClockState(), createGameService(), addRoomListener(), appendChatEntry(), appendSystemChat() (+62 more)

### Community 3 - "bootstrapApp"
Cohesion: 0.18
Nodes (26): applyIncomingSseGame(), authenticateChatSocket(), bootstrapApp(), cancelActiveAnalysis(), clearAvatarBubbles(), connectChatSocket(), connectGameEvents(), disconnectChatSocket() (+18 more)

### Community 4 - "chessUiHelper.test.js"
Cohesion: 0.13
Nodes (30): renderAvatarBubbles(), showAvatarBubble(), applyOptimisticMove(), canSendMatchChat(), CAPTURE_SORT_ORDER, clampBubblePosition(), computeCapturedMaterial(), FILES (+22 more)

### Community 5 - "aiEngine.js"
Cohesion: 0.08
Nodes (33): dependencies, chess.js@^1.4.0, stockfish@^19.0.1, ws@^8.22.2, description, name, private, scripts (+25 more)

### Community 6 - "httpServer.test.js"
Cohesion: 0.11
Nodes (27): openSseClient(), openWsClient(), rawHttpGet(), REAL_PUBLIC_DIR, REAL_STOCKFISH_DIR, startTestServer(), testCreateAndGetGameEndpoint(), testCreateGameRejectsInvalidPayload() (+19 more)

### Community 7 - "steps"
Cohesion: 0.10
Nodes (19): concurrency, cancel-in-progress, group, jobs, verify, name, on, pull_request (+11 more)

### Community 8 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): copyCompanionRelayScript(), buildFenFromPiecePlacements(), calculateSquareCenter(), executeChessComMove(), FILES, generateBookmarklet(), generateRelayScript(), getRandomAutoMoveDelayMs() (+8 more)

### Community 9 - "services"
Cohesion: 0.17
Nodes (11): services, autoDeployTrigger, branch, buildCommand, healthCheckPath, name, plan, region (+3 more)

### Community 10 - "renderApp"
Cohesion: 0.14
Nodes (25): applyLanguage(), canReviewGame(), copyInviteLink(), describeGameOutcome(), dismissGameOverModal(), formatStatusBanner(), getViewerColor(), handleRematchAction() (+17 more)

### Community 11 - "analysisHelper.test.js"
Cohesion: 0.08
Nodes (56): CLASSIFICATION_KEYS, classifyMove(), computeConsecutiveBestMovesStreak(), computeMoveAccuracy(), DEFAULT_CONSECUTIVE_BEST_MOVES_THRESHOLD, detectBrilliantMove(), detectGreatMove(), evalToWinPercent() (+48 more)

### Community 12 - "handleCompanionSnapshot"
Cohesion: 0.10
Nodes (44): formatEvalScore(), appendBoardArrow(), dispatchCompanionAutoMove(), handleCompanionSnapshot(), renderAnalysisPanel(), renderCompanionBestMoveArrow(), renderCompanionBoard(), renderCompanionEval() (+36 more)

### Community 13 - "handlePointerUp"
Cohesion: 0.15
Nodes (20): applySelectionClasses(), clearDragState(), closePromotionModal(), getLegalMovesFromSquare(), handleBoardPointerDown(), handlePointerMove(), handlePointerUp(), handleSquareSelectOrMove() (+12 more)

### Community 14 - "i18n.js"
Cohesion: 0.36
Nodes (7): DEFAULT_LANGUAGE, initI18n(), resolveStorage(), setLanguage(), STORAGE_KEY, SUPPORTED_LANGUAGES, TRANSLATIONS

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createGameService()` connect `createGameService` to `ref_node_assert`, `httpServer.js`, `httpServer.test.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `createGameService()` (e.g. with `applyPlayerMove()` and `createGame()`) actually correct?**
  _`createGameService()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09803921568627451 - nodes in this community are weakly interconnected._
- **Why does `chess.js` connect `aiEngine.js` to `httpServer.js`, `createGameService`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `httpServer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `createCompanionService()` connect `ref_node_assert` to `httpServer.js`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `createGameService` be split into smaller, more focused modules?**
  _Cohesion score 0.07592407592407592 - nodes in this community are weakly interconnected._