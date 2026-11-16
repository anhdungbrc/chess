# AI Coding Rule

Bộ luật bắt buộc cho AI agent (Claude Code, Cursor, Copilot, Codex...) khi viết, sửa, review hoặc debug code. Toàn bộ luật nằm trong [CODING_RULES.md](CODING_RULES.md).

## Mục đích

- Agent hiểu yêu cầu trước khi code, không đoán.
- Diff nhỏ, đúng phạm vi, truy ngược được về yêu cầu.
- Có test và bằng chứng chạy thật trước khi tuyên bố "xong".
- Báo cáo trung thực, ngắn gọn.

## Cách sử dụng

### 1. Đưa luật vào dự án

Copy [CODING_RULES.md](CODING_RULES.md) vào thư mục gốc của dự án (hoặc `docs/`).
Với Antigravity nên để ở thư mục gốc cùng `AGENTS.md`.

### 2. Bắt agent đọc luật

Agent không tự đọc file này. Hãy trỏ tới nó trong file chỉ dẫn mà công cụ của bạn tự nạp:

| Công cụ | File cần sửa |
|---|---|
| Claude Code | `CLAUDE.md` |
| Codex, agent dùng chuẩn chung | `AGENTS.md` |
| Cursor | `.cursor/rules/` hoặc `.cursorrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Google Antigravity | `AGENTS.md`, `GEMINI.md` hoặc `.agents/rules/*.md` (xem bên dưới) |

Nội dung mẫu để thêm vào:

```markdown
BẮT BUỘC: trước khi phân tích, thiết kế hoặc viết bất kỳ code nào, đọc toàn bộ `CODING_RULES.md` ở thư mục gốc. Không bắt đầu công việc khi chưa đọc.
```

Viết theo kiểu mệnh lệnh như trên, không viết kiểu gợi ý, để agent ít bỏ qua hơn. Dự án này có sẵn [AGENTS.md](AGENTS.md) với nội dung đó.

Với Claude Code có thể dùng import: `@CODING_RULES.md`.

#### Google Antigravity

Antigravity nạp luật từ các vị trí sau (tổng hợp từ [tài liệu của Antigravity](https://antigravity.google/docs/rules) và các blog bên thứ ba, chưa kiểm chứng trực tiếp):

| Phạm vi | Vị trí |
|---|---|
| Workspace | `AGENTS.md`, `GEMINI.md` hoặc `.agents/rules/*.md` ở thư mục gốc dự án |
| Thư mục con | Cùng các tên trên, chỉ áp dụng khi agent làm việc trong thư mục đó |
| Toàn cục | `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md` hoặc `~/.gemini/config/rules/*.md` |

Cách làm đơn giản nhất:

1. Copy `CODING_RULES.md` vào thư mục gốc dự án.
2. Tạo `AGENTS.md` ở thư mục gốc với câu lệnh mẫu ở trên.
3. Mở một phiên mới trong Antigravity rồi hỏi agent: "Liệt kê 10 luật bạn đang áp dụng" để xác nhận nó đã nạp luật.

Lưu ý:

- `AGENTS.md` chỉ trỏ tới `CODING_RULES.md` nên agent vẫn phải tự mở file đó, không đảm bảo luôn đọc. Nếu bước 3 cho thấy agent không biết luật, dùng phương án dự phòng: tách `CODING_RULES.md` thành vài file nhỏ trong `.agents/rules/` và đặt chế độ kích hoạt "Always On". Một số blog nói mỗi file luật có giới hạn 12.000 ký tự (chưa xác nhận từ nguồn chính thức), trong khi `CODING_RULES.md` dài khoảng 13.500 ký tự, nên không nhét nguyên file vào một rule được.
- Đường dẫn cũ `.agent/rules/` (số ít) vẫn được hỗ trợ nhưng là dạng legacy, nên dùng `.agents/rules/`.
- Antigravity và Gemini CLI dùng chung `~/.gemini/GEMINI.md`, nên luật toàn cục đặt ở đó sẽ ảnh hưởng cả hai công cụ.
- Thứ tự ưu tiên giữa `AGENTS.md` và `GEMINI.md` khi cùng tồn tại ở một cấp chưa được xác nhận trong tài liệu. Chỉ dùng một trong hai để tránh mâu thuẫn.

### 3. Bổ sung thông tin dự án

Luật 1.3 yêu cầu agent lấy lệnh build, test, lint từ file cấu hình. Nên ghi sẵn vào `CLAUDE.md` hoặc `AGENTS.md`:

```markdown
## Lệnh
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

## Quy ước
- Ngôn ngữ comment: tiếng Việt
- Tầng kiến trúc: controller -> service -> repository
```

### 4. Làm việc với agent

- Giao việc như bình thường. Agent sẽ luôn bắt đầu ở Plan mode (nêu giả định, hỏi điểm chưa rõ, xuất plan có phân rã task chuẩn rule, kết luận điều kiện thực thi kèm checklist hậu kiểm và chờ bạn duyệt) rồi mới sửa code.
- Muốn bỏ qua một bước, nói rõ bằng lời. Ví dụ: "bỏ qua plan mode", "bỏ qua test-first" hoặc "cứ làm đi".
- Khi luật xung đột với chỉ dẫn của bạn, agent làm theo bạn và nêu xung đột trong một câu.

## Tóm tắt các luật

| # | Luật | Ý chính |
|---|---|---|
| 1 | Nạp ngữ cảnh | Đọc tài liệu và code trước, nêu giả định, hỏi khi chưa rõ |
| 2 | Plan mode & thiết kế | Luôn vào Plan mode lập plan (gọn hoặc đầy đủ) có phân rã task chuẩn rule, kết luận điều kiện thực thi và checklist hậu kiểm, chờ user duyệt |
| 3 | Đơn giản trước | Code tối thiểu, không thêm thứ chưa ai yêu cầu |
| 4 | Sửa phẫu thuật | Chỉ đổi thứ cần đổi, việc không liên quan thì báo cáo |
| 5 | Test trước | Red rồi green, làm theo từng vertical slice |
| 6 | Bằng chứng | Chạy lệnh và dẫn output trước khi nói "xong" |
| 7 | Debug gốc rễ | Tìm root cause, sau 3 lần sửa thất bại thì dừng và hỏi |
| 8 | Review | Tự review hai trục: Spec và Standards |
| 9 | Đặt tên, comment | Tên tường minh; mọi hàm (code & test) có doc comment tiếng Anh đầu hàm, inline giải thích "tại sao" |
| 10 | Giao tiếp | Kết quả đúng sự thật, ngắn gọn, dẫn đầu bằng điều quan trọng |

## Thứ tự ưu tiên

Chỉ dẫn trực tiếp của user > `CODING_RULES.md` > tài liệu dự án (`CLAUDE.md`, `AGENTS.md`) > hành vi mặc định.

## Phạm vi áp dụng

- Mọi tác vụ viết, sửa hoặc debug code đều phải bắt đầu ở Plan mode (chỉ câu hỏi không chạm code được miễn).
- Tác vụ tầm thường (sửa chính tả, đổi tên một dòng) hoặc 1 hướng rõ dùng **Plan gọn**; tác vụ tầm thường vẫn được bỏ qua Luật 5 nếu không chạm logic.
- Luật 4, 6, 10 áp dụng cho mọi tác vụ.
- Chỉ user mới miễn được duyệt plan (Luật 2), test-first (Luật 5) và việc chạy kiểm tra (Luật 6). Agent vẫn phải nói rõ phần nào chưa xác minh.

## Kiểm tra agent có tuân thủ không

Dùng **Checklist hậu kiểm** ngay trong bản plan của agent và danh sách "Tự kiểm tra trước mỗi phản hồi có code" ở cuối [CODING_RULES.md](CODING_RULES.md) khi review kết quả. Các dấu hiệu vi phạm thường gặp:

- Agent tự ý sửa file trước khi xuất plan và được duyệt.
- Agent phân rã task sai rule (tách ngang thiếu test hoặc gom code trước test sau) hoặc tự thực thi khi plan chưa kết luận đủ điều kiện.
- Agent nói "xong" nhưng không có output lệnh test.
- Diff có thay đổi không liên quan đến yêu cầu.
- Agent code ngay khi yêu cầu còn nhiều cách hiểu.
- Test được viết sau code và pass ngay lần đầu.

## Tuỳ chỉnh

Sửa trực tiếp [CODING_RULES.md](CODING_RULES.md) cho phù hợp với đội ngũ. Giữ nguyên số thứ tự luật, vì các luật tham chiếu chéo nhau (ví dụ Luật 1.7, Luật 5.7).
