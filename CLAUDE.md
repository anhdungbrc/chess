# CLAUDE.md

Hướng dẫn lệnh và quy ước cho ứng dụng web cờ vua đấu với AI trong thư mục `chess/`.
Tuân thủ toàn bộ luật tại [../CODING_RULES.md](../CODING_RULES.md).

## Lệnh chạy và kiểm tra

Chạy từ thư mục `d:\ai_coding_rule\chess`:

- Start server: `npm start` (mặc định `http://localhost:3000`, tùy chỉnh qua biến môi trường `PORT`)
- Test: `npm test` (`node --test`)
- Kiểm tra cú pháp JS: `npm run check` (`node --check` trên các file mã nguồn)
- Lint / Build: Không dùng công cụ build hoặc linter ngoài (ES Modules thuần + Vanilla JS)

## Quy ước kiến trúc

- `src/domain/`: Logic cờ vua thuần và AI Minimax/Alpha-Beta (không phụ thuộc HTTP hoặc DOM).
- `src/service/`: Điều phối vòng đời ván đấu in-memory (`Map`), áp dụng nước đi người chơi -> AI đáp trả, và Undo.
- `src/server/`: HTTP server (`node:http`), validate input 1 lần tại ranh giới API, phục vụ static từ `public/`.
- `public/`: Giao diện HTML/CSS/Vanilla JS gọi REST API, không lặp lại rule kiểm tra hợp lệ làm nguồn chân lý.
- Doc comment: Mọi hàm mới/sửa (cả code và test) có JSDoc tiếng Anh ở đầu hàm; comment inline giải thích "tại sao" cho logic không hiển nhiên.
