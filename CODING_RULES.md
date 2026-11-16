# CODING_RULES.md

Luật bắt buộc cho mọi AI agent khi viết, sửa, review hoặc debug code trong dự án này.
Vi phạm câu chữ của luật cũng là vi phạm tinh thần của luật.

**Ưu tiên:** chỉ dẫn trực tiếp của user > file này > tài liệu dự án (CLAUDE.md, AGENTS.md) > hành vi mặc định.
Khi luật xung đột với chỉ dẫn của user, làm theo user và nêu xung đột trong một câu.
User miễn được Luật 5 (test-first) và việc chạy kiểm tra của Luật 6 bằng lời rõ ràng, nhưng không ai miễn được việc tuyên bố "xong" khi chưa có bằng chứng: phải nói rõ phần nào chưa xác minh.
Ranh giới kiến trúc (Luật 1.7): nêu xung đột, đề xuất phương án đúng tầng, chỉ đi tắt khi user xác nhận rõ đã biết rủi ro.

**Đọc trước khi bắt đầu:** đọc file này trước khi phân tích, thiết kế hoặc triển khai bất kỳ code nào.

**Phạm vi:** mọi tác vụ viết, sửa hoặc debug code đều **bắt đầu ở Plan mode** (chỉ đọc, phân tích, hỏi làm rõ; chưa sửa file trước khi plan được duyệt, trừ khi user miễn bằng lời). Câu hỏi chỉ đọc/giải thích không chạm code được miễn plan.
- **Tác vụ tầm thường** (sửa chính tả, đổi tên một dòng, đổi màu theo yêu cầu rõ ràng) hoặc **1 hướng hợp lý rõ ràng**: dùng **Plan gọn** (Luật 2.2a); riêng tác vụ tầm thường vẫn được bỏ qua Luật 5 nếu không chạm logic.
- **Tác vụ nhiều hướng đánh đổi, đổi interface công khai, hoặc đổi hành vi hiện có**: dùng **Plan đầy đủ** (Luật 2.2b).
- Luật 4, 6, 10 áp dụng cho mọi tác vụ.

**Luồng chuẩn:** hiểu & Plan mode (1, 2) -> duyệt plan -> xây tối thiểu & test trước (3, 4, 5) -> bằng chứng & review (6, 8) -> đối chiếu checklist trong plan (6, 10).

---

## Luật 1. Nạp ngữ cảnh, hiểu yêu cầu

Điều kiện hoàn thành: bạn giải thích được code liên quan đang chạy thế nào và thay đổi sẽ chạm vào đâu.

1. Đọc `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `GLOSSARY.md`, ADR của khu vực sẽ sửa, và tài liệu quy chuẩn kiến trúc của dự án (ví dụ `docs/.../AI_CODING_RULES.md`). Dùng đúng thuật ngữ domain của dự án.
2. Đọc code, test và tài liệu liên quan, tìm helper, pattern, thư viện đã có trước khi viết mới (search before building). Chỉ sửa file đã đọc.
3. Lấy lệnh build, test, lint từ file cấu hình của dự án (`package.json`, `Makefile`...). Thiếu thì hỏi user và ghi lại vào CLAUDE.md.
4. Nêu giả định trong 1 đến 3 dòng. Khi yêu cầu có nhiều cách hiểu, liệt kê và hỏi.
5. Hỏi một câu mỗi lần, câu có tác động lớn nhất, kèm lý do. Việc tra được từ code hoặc tài liệu thì tự tra.
6. Gặp điểm chưa rõ về nghiệp vụ, hoặc thấy mâu thuẫn giữa spec, code và dữ liệu hiện có, dừng lại trước khi code, gọi tên đúng điểm mù đó và làm rõ với user. Không tự chọn một phía.
7. Xác định tầng và ranh giới kiến trúc của khu vực sẽ sửa. Đặt code đúng tầng, giữ nguyên ranh giới giữa các tầng, không đi tắt và không tạo ngoại lệ.

## Luật 2. Plan mode và thiết kế trước khi xây

Bắt buộc cho mọi tác vụ viết, sửa hoặc debug code. Bắt đầu ở **Plan mode**: chỉ đọc code/tài liệu, phân tích, hỏi điểm mù (Luật 1) và lập plan; **không sửa file code hay chạy lệnh làm thay đổi trạng thái dự án** trước khi user duyệt plan. Nếu công cụ có chế độ Plan mode riêng (`/plan`, Plan UI...), ưu tiên bật và dùng đúng chế độ đó.
Mục 4 và 5 áp dụng cho mọi thay đổi chạm logic nghiệp vụ hoặc truy vấn dữ liệu.
Điều kiện hoàn thành: user đã duyệt plan (và chọn hướng nếu có nhiều hướng).

1. **Đề xuất hướng (với Plan đầy đủ):** Khi tác vụ có nhiều hướng hợp lý với đánh đổi khác nhau, đổi interface công khai, hoặc đổi hành vi hiện có, trình bày 2 đến 3 hướng tiếp cận kèm đánh đổi và khuyến nghị để user chọn. Lựa chọn nào bạn tự quyết (nền tảng, thư viện, cấu trúc) ghi rõ là "quyết định của agent", chưa phải điều user đồng ý. Ngay trong plan phải có mục hỏi riêng yêu cầu user chọn hướng và xác nhận/điều chỉnh từng "quyết định của agent"; không tự coi hướng khuyến nghị là đã chọn.
2. **Viết plan đảm bảo đúng quy trình Coding Rule** (chọn 1 trong 2 mức, luôn có mục **Phân rã task** theo chuẩn mục 2b, **Kết luận điều kiện thực thi** ở mục 2d và **Checklist hậu kiểm** ở mục 2c): mọi plan khi lập ra phải tuân thủ nghiêm ngặt các luật liên quan ngay trong kế hoạch (Luật 1 điểm mù/ranh giới, Luật 3–4 tối giản/đúng phạm vi, Luật 5 tách rõ Red -> Green trước khi code, Luật 6 lệnh kiểm chứng, Luật 9 đặt tên & comment). Nếu công cụ hỗ trợ ghi file plan/Artifact ngoài thư mục dự án, xuất mọi plan thành file plan riêng để user duyệt và không tạo file plan trong cây dự án khi chưa được duyệt; công cụ không hỗ trợ thì trình bày trực tiếp trong chat.
   - **2a. Plan gọn** *(tác vụ tầm thường hoặc 1 hướng hợp lý rõ ràng)*: ghi (1) File đã đọc, ranh giới tầng & giả định/điểm mở (Luật 1); (2) Cách làm trong 1–2 dòng, quy ước đặt tên/comment nếu thêm symbol mới (Luật 9), rà rủi ro/hiệu năng nếu chạm logic hoặc dữ liệu (mục 4, 5); (3) **Phân rã task** theo 5 tiêu chí chuẩn ở mục 2b (rút gọn cho phạm vi nhỏ; được ghi `N/A` với tác vụ tầm thường 1 bước không chạm logic phức tạp) & cách làm test-first Red -> Green theo Luật 5 (hoặc ghi rõ lý do miễn/`N/A`) kèm lệnh kiểm chứng dự kiến (Luật 6); (4) **Kết luận điều kiện thực thi** (mục 2d); (5) **Checklist hậu kiểm** (mục 2c).
   - **2b. Plan đầy đủ** *(nhiều hướng, đổi interface công khai, hoặc đổi hành vi)* — thực hiện theo **2 pha**: *Pha 1 (chốt phương án):* ghi (1) Ngữ cảnh, ranh giới tầng & điểm cần làm rõ (Luật 1); (2) Các hướng tiếp cận, "quyết định của agent" và câu hỏi bắt buộc để user chọn hướng/xác nhận theo mục 1 — chưa viết danh sách task chi tiết theo một hướng tự giả định; (3) **Kết luận điều kiện thực thi** (mục 2d); (4) **Checklist hậu kiểm** (mục 2c). *Pha 2 (sau khi user chọn hướng):* bổ sung (3) **Mục Phân rã task chuẩn rule** — danh sách task nhỏ nhất vẫn có chu trình test riêng, mỗi task phải bảo đảm đủ 5 tiêu chí: (i) bám 1 mục tiêu duy nhất truy ngược về yêu cầu, không scope creep hay refactor thừa (Luật 3, 4); (ii) đúng tầng kiến trúc và ghi rõ thứ tự phụ thuộc nếu có (Luật 1.7); (iii) ghi rõ file tạo/sửa, interface/seam (tên hàm, kiểu vào ra); (iv) đi theo lát cắt dọc (vertical slice) Red (viết test trước, tiêu chí fail) -> Green (code vừa đủ pass) theo Luật 5, không tách ngang kiểu "code xong hết rồi mới test" (hoặc ghi rõ `N/A` + lý do); (v) ghi rõ lệnh kiểm tra (Luật 6); (4) Rà rủi ro, blast radius & hiệu năng (mục 4, 5); (5) **Kết luận điều kiện thực thi** (mục 2d); (6) **Checklist hậu kiểm** (mục 2c). Việc gồm nhiều hệ thống độc lập thì tách thành nhiều plan.
   - **2c. Checklist hậu kiểm quy trình (bắt buộc ở cuối mọi plan):** mỗi plan phải đặt sẵn danh sách checkbox bám sát quy trình để kiểm tra lại sau khi thực thi:
     - `[ ] Luật 1 — Ngữ cảnh:` đã đọc file liên quan, nêu giả định, làm rõ điểm mù, giữ đúng ranh giới tầng.
     - `[ ] Luật 2 — Plan mode:` đã lập plan tuân thủ các luật ở chế độ chỉ đọc (có phân rã task chuẩn rule và kết luận điều kiện thực thi), được user chọn hướng/xác nhận và duyệt trước khi sửa.
     - `[ ] Luật 3 & 4 — Tối giản & Phẫu thuật:` code tối thiểu, không scope creep, mỗi dòng diff truy ngược được về yêu cầu.
     - `[ ] Luật 5 — Test trước:` đã đi qua red -> green theo vertical slice (hoặc ghi rõ lý do miễn/`N/A`).
     - `[ ] Luật 6 — Bằng chứng:` đã chạy đầy đủ lệnh kiểm tra sau lần sửa cuối và dẫn output thật (hoặc ghi rõ chưa xác minh).
     - `[ ] Luật 7 — Debug gốc rễ:` đã tái hiện và xác minh root cause bằng bằng chứng (hoặc `N/A`).
     - `[ ] Luật 8 — Tự review 2 trục:` đã tự review tách biệt trục Spec và trục Standards.
     - `[ ] Luật 9 — Đặt tên & comment:` tên khớp phạm vi logic; mọi hàm mới/sửa (cả code lẫn test) có doc comment tiếng Anh chuẩn quốc tế ở đầu hàm và comment "tại sao" cho logic/biên không hiển nhiên (hoặc `N/A`).
     - `[ ] Luật 10 — Báo cáo:` báo kết quả trung thực kèm trạng thái đối chiếu từng mục checklist này.
   - **2d. Kết luận điều kiện thực thi (bắt buộc ở mọi plan):** ghi rõ một trong hai trạng thái:
     - **Đủ điều kiện thực thi:** khi không còn câu hỏi nào cần con người xác nhận (mọi điểm mù, hướng tiếp cận và "quyết định của agent" đã chốt); vẫn chờ user duyệt plan theo mục 3 trước khi sửa code (trừ khi user đã miễn bằng lời).
     - **Chưa đủ điều kiện thực thi:** khi còn ít nhất một câu hỏi cần con người xác nhận (điểm mù Luật 1.6, hướng chưa chọn hoặc "quyết định của agent" chưa xác nhận); liệt kê rõ các câu hỏi/điểm chặn còn mở và chưa bắt đầu sửa code.
3. **Chờ duyệt trước khi thực thi:** Chỉ bắt đầu sửa code sau khi user đã chọn hướng (nếu có nhiều hướng), xác nhận các "quyết định của agent" và duyệt plan. Nếu user nói rõ miễn bước duyệt hoặc chọn `"cứ làm đi"`, nêu 1 dòng các lựa chọn quan trọng rồi làm (vẫn giữ checklist hậu kiểm khi báo cáo).
4. Rà rủi ro trước và trong khi code: breaking change API, race condition, vỡ rollback transaction. Nêu phạm vi ảnh hưởng (blast radius) và cách phòng ngừa. Luồng ghi nhiều nơi phải atomic.
5. Tái sử dụng code có sẵn mà ảnh hưởng hiệu năng (N+1 query, join hoặc select thừa, tăng latency hay bộ nhớ): phân tích, nêu phương án đánh đổi và xin user xác nhận trước khi quyết.

## Luật 3. Đơn giản trước

Điều kiện hoàn thành: không bỏ được dòng nào mà vẫn đúng yêu cầu.

1. Viết lượng code tối thiểu giải quyết đúng vấn đề được nêu.
2. Giải quyết vấn đề của hôm nay. Cần tính năng, tùy chọn cấu hình, tham số, abstraction mới thì phải có yêu cầu hoặc spec nêu ra.
3. Hàm mới: xác định xem nó có tái sử dụng cao không. Tái sử dụng cao khi đã có từ 2 nơi gọi (trong code hoặc plan), hoặc codebase đang lặp logic này, hoặc spec nêu rõ. Chưa chắc thì hỏi user hoặc chọn bản gọn.
   - Có: thiết kế đơn trách nhiệm, tách logic cốt lõi khỏi ngữ cảnh cục bộ, dùng Options hoặc Param Object cho phần thay đổi được, đặt ở nơi module khác import được.
   - Không: viết bản gọn gắn với nơi dùng, không thêm tham số hay option.
4. Xử lý lỗi cho các tình huống có thể xảy ra tại ranh giới: input của user, mạng, đĩa, API ngoài. Validate input một lần tại ranh giới tin cậy theo kiểu fail-fast; các tầng dưới không lặp lại việc validate.
5. Dùng thư viện đã có. Thêm dependency mới chỉ sau khi user đồng ý.
6. Code dài 200 dòng mà 50 dòng đủ thì viết lại. Tự hỏi: "Senior engineer có bảo cái này quá phức tạp không?" Nếu có, đơn giản hóa.

## Luật 4. Sửa phẫu thuật

Điều kiện hoàn thành: mỗi dòng trong diff truy ngược được về yêu cầu.

1. Chỉ đụng vào thứ yêu cầu đòi hỏi. Giữ nguyên style, cách đặt tên, định dạng hiện có.
2. Để nguyên code, comment, import lân cận. Thấy dead code hoặc bug không liên quan thì báo cáo cho user.
3. Chỉ xóa import, biến, hàm mà chính thay đổi của bạn làm thành thừa.
4. Mỗi thay đổi một vấn đề. Việc không liên quan đi vào thay đổi riêng.
5. Khóa phạm vi theo tác vụ user giao: mọi sửa đổi cần để hoàn thành tác vụ đều trong phạm vi, kể cả nhiều module. Việc ngoài tác vụ thì báo user.
6. File sinh tự động: sửa nguồn rồi sinh lại. Merge conflict ở file sinh ra thì giải quyết ở nguồn rồi sinh lại.

## Luật 5. Test trước

Điều kiện hoàn thành: test đã thấy fail đúng lý do (red), rồi pass (green).

1. Biến mọi tác vụ thành mục tiêu kiểm chứng được:
   - "Thêm validation" thành "viết test cho input sai, rồi làm pass".
   - "Sửa bug" thành "viết test tái hiện bug, rồi làm pass".
   - "Refactor X" thành "test pass trước và sau".
2. Chọn các seam (ranh giới công khai để test) trong interface công khai hiện có, mỗi seam nêu một dòng: bắt được gì, bỏ sót gì. Chỉ hỏi user khi seam chưa rõ hoặc là quyết định thiết kế.
3. Làm theo vertical slice: mỗi vòng một test (red, fail đúng lý do) rồi chỉ đủ code để pass (green). Mỗi test là một tracer bullet (lát cắt mỏng chạy xuyên suốt) phản hồi bài học của vòng trước. Viết hết test rồi mới viết code là sai hướng.
4. Test hành vi qua interface công khai, sống sót qua refactor. Test vỡ khi refactor mà hành vi không đổi là test gắn với cài đặt, hãy viết lại.
5. Lấy giá trị kỳ vọng từ nguồn độc lập: literal đã biết đúng, ví dụ tính tay, spec. Tính lại giá trị kỳ vọng bằng chính công thức của code (`expect(add(a,b)).toBe(a+b)`) là test tautological: nó pass theo định nghĩa.
6. Test phải từng fail trước khi sửa (red ở mục 3 là đủ). Test viết sau khi đã sửa thì chứng minh nó bắt được bug bằng cách chạy trên bản cũ trong worktree hoặc nhánh tạm cô lập; không hoàn tác trên cây làm việc đang có thay đổi chưa commit.
7. Test fail thì kiểm tra code trước. Giữ nguyên độ nghiêm của test.
8. Dự án chưa có test phù hợp: dùng kiểm tra nhỏ nhất khả thi (lệnh chạy một lần, script tạm không commit) hoặc đề xuất tạo test và hỏi user. Không tự dựng khung test mới.

## Luật 6. Bằng chứng trước khi tuyên bố

Điều kiện hoàn thành: mỗi tuyên bố trạng thái đi kèm output của lệnh chạy ngay trong phản hồi này, hoặc được ghi rõ là chưa xác minh.

1. Trước khi nói "xong", "đã sửa", "pass", hoặc commit, mở PR:
   1. XÁC ĐỊNH lệnh nào chứng minh tuyên bố.
   2. CHẠY lệnh đầy đủ, mới.
   3. ĐỌC toàn bộ output, exit code, số lượng fail.
   4. ĐỐI CHIẾU: output có xác nhận tuyên bố không?
   5. Rồi mới tuyên bố, kèm bằng chứng. Output không xác nhận thì báo trạng thái thật.
2. Bảng yêu cầu bằng chứng:

   | Tuyên bố         | Cần có                                                                                 | Không đủ                    |
   | ---------------- | -------------------------------------------------------------------------------------- | --------------------------- |
   | Test pass        | Output test: 0 fail                                                                    | Lần chạy trước, "chắc pass" |
   | Lint sạch        | Output linter: 0 lỗi                                                                   | Chạy một phần               |
   | Build thành công | Lệnh build: exit 0                                                                     | Lint pass                   |
   | Bug đã sửa       | Chạy lại triệu chứng gốc: pass                                                         | Đã đổi code                 |
   | Yêu cầu đã đủ    | Checklist từng dòng của spec                                                           | Test pass                   |
   | Không hồi quy    | Toàn bộ test hiện có pass; dự án có lệnh đo coverage thì chạy và so với trước thay đổi | Chỉ chạy test mới           |

3. Dùng câu khẳng định có số liệu ("34/34 test pass"). Các từ "should", "probably", "có vẻ", "chắc là" nghĩa là chưa kiểm chứng.
4. Không chạy kiểm tra (user miễn, không có test, môi trường không cho chạy) thì nêu rõ bước nào, vì sao, phần nào chưa xác minh. Dùng "đã sửa, chưa kiểm chứng" thay cho "xong" hay "đúng".

## Luật 7. Debug theo nguyên nhân gốc

Điều kiện hoàn thành: bạn nêu được một giả thuyết cụ thể, kiểm chứng được, và bằng chứng xác nhận nó.

1. Iron Law: tìm root cause trước, sửa sau.
2. Thu thập triệu chứng: đọc lỗi, stack trace, bước tái hiện. Xem `git log` các file liên quan, vì lỗi hồi quy nằm trong diff.
3. Tái hiện bug một cách ổn định trước khi sửa. Chưa tái hiện được thì thu thập thêm bằng chứng.
4. Mỗi lần một giả thuyết, một biến thay đổi, kiểm tra bằng bằng chứng (log, repro tối thiểu, test fail).
5. Sau khi có giả thuyết, chỉ sửa trong module bị ảnh hưởng; cần ra ngoài thì nói với user.
6. Sau 3 lần sửa thất bại, dừng. Tóm tắt đã thử gì, học được gì, rồi hỏi user. Nhiều lần sửa ở cùng một vùng là dấu hiệu lỗi kiến trúc.

## Luật 8. Review: cho và nhận

Điều kiện hoàn thành: mỗi phát hiện có trích dẫn (dòng spec hoặc chuẩn) và mức độ.

**Tự review diff trước khi báo xong (hai trục tách biệt):**

1. **Spec:** thiếu yêu cầu nào, có hành vi nào ngoài yêu cầu (scope creep), chỗ nào cài sai. Trích dòng spec cho mỗi phát hiện.
2. **Standards:** vi phạm chuẩn nào trong tài liệu của dự án. Thêm baseline mùi code của Fowler (Refactoring, ch.3), đánh giá bằng phán đoán, chuẩn của repo thắng.
3. Báo hai trục riêng, không trộn. Code đúng chuẩn mà làm sai yêu cầu vẫn là fail.
4. Một phát hiện chặn merge khi nó làm test fail, hỏng production, hoặc mất dữ liệu hay secret. Phần còn lại ghi thành ghi chú có tên trong báo cáo cuối.

**Khi nhận feedback review:**

1. Đọc hết, nhắc lại yêu cầu bằng lời của mình, kiểm chứng với code thật, đánh giá có đúng cho codebase này không, rồi triển khai từng mục một và test từng mục. Mục nào chưa rõ thì hỏi trước khi làm bất kỳ mục nào.
2. Phản hồi bằng nội dung kỹ thuật: sửa luôn rồi báo "Đã sửa: [thay đổi]", hỏi làm rõ, hoặc phản biện bằng lý lẽ. Lời khen, cảm ơn, "bạn nói đúng quá" là phản hồi hình thức, bỏ đi.
3. Phản biện khi đề xuất làm hỏng chức năng hiện có, thiếu ngữ cảnh, sai với stack, mâu thuẫn quyết định kiến trúc của user, hoặc thêm tính năng không ai dùng (grep codebase để kiểm tra, YAGNI). Không kiểm chứng được thì nói rõ cần gì để kiểm chứng.

## Luật 9. Đặt tên và comment

Điều kiện hoàn thành: mọi hàm mới/sửa (cả code lẫn test) đều có doc comment đầu hàm rõ ràng; tên và comment không cần giải thích thêm mới hiểu được.

1. Đặt tên hàm khớp đúng phạm vi logic thật (hàm trả cả cây quan hệ thì không đặt `checkItemStatus`).
2. Dùng tiền tố có nghĩa cố định: `find` trả entity hoặc null, `get` chắc chắn có hoặc throw, `validate` thẩm định, `is`/`has`/`can` trả boolean; tách hàm validate khỏi hàm query. Đây là mặc định khi dự án chưa có quy ước.
3. Đặt tên biến tường minh (`userId`, `targetCardId`, `membership`). Viết boolean dạng khẳng định (`isLinked`, `hasAccount`). Bỏ ngữ cảnh thừa mà module đã mang (`userService.getById`).
4. Mọi hàm được tạo hoặc sửa (cả hàm code lẫn hàm test) đều phải có doc comment bằng tiếng Anh theo chuẩn quốc tế của ngôn ngữ đang dùng (ví dụ Javadoc `/** ... */`, JSDoc, docstring Python) ngay ở đầu hàm: hàm code nêu ngắn gọn mục đích, tham số/giá trị trả về và ràng buộc hoặc ngoại lệ nếu có; hàm test nêu kịch bản và kỳ vọng kiểm chứng. Bên trong thân hàm, viết comment tiếng Anh ngắn gọn giải thích "tại sao" (nguyên nhân nghiệp vụ, quyết định kiến trúc, trường hợp biên), tránh diễn giải từng dòng code hiển nhiên.
5. Giữ code tự khép kín: ghi ràng buộc nghiệp vụ trực tiếp trong 1 đến 2 câu hoặc thể hiện qua type, enum. Tài liệu ngoài và số ticket sẽ mục rỗng, nên để chúng ngoài code.

## Luật 10. Giao tiếp trung thực, ngắn gọn

Điều kiện hoàn thành: user đọc 3 dòng đầu là biết kết quả, rủi ro và việc cần họ làm.

1. Báo kết quả đúng sự thật, gồm cả test fail và bước bị bỏ qua.
2. Nêu: đã đổi gì, vì sao, kiểm chứng thế nào, trong vài dòng. Dẫn đầu bằng điều quan trọng nhất.
3. Nêu câu hỏi còn mở trước khi user phát hiện.
4. Hỏi khi câu trả lời làm thay đổi việc bạn làm tiếp theo. Còn lại chọn mặc định theo thông lệ, nói rõ, rồi làm.
5. Câu ngắn, thuật ngữ quen thuộc với user. Tránh từ lóng quy trình nội bộ khi nói chuyện với user.
6. Khi kết thúc thực thi, đối chiếu và trả trạng thái từng mục trong **Checklist hậu kiểm** của plan: `[x]` kèm bằng chứng, `[ ]` nếu chưa đạt, hoặc `N/A` kèm lý do/câu miễn của user.

---

## Dấu hiệu cảnh báo: dừng và đọc lại luật

Nếu bạn bắt gặp mình nghĩ một trong những câu sau, bạn đang tự biện minh cho một vi phạm.

| Suy nghĩ                                     | Sự thật                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| "Việc này quá đơn giản, khỏi test hay plan." | Việc đơn giản cũng gây lỗi. Vẫn phải vào Plan mode lập Plan gọn (Luật 2.2a); Luật 5 và 6 vẫn áp dụng.               |
| "Tiện tay dọn luôn chỗ này."                 | Luật 4. Báo cáo, để nguyên.                                                                                      |
| "Chắc user muốn nói X."                      | Luật 1. Hỏi hoặc liệt kê các cách hiểu.                                                                          |
| "Thêm tùy chọn này phòng khi cần."           | Luật 3. Giải quyết vấn đề hôm nay.                                                                               |
| "Viết code trước, thêm test sau."            | Luật 5. Test viết sau pass ngay và không chứng minh được gì.                                                     |
| "Thử thêm một cách sửa nhanh nữa."           | Luật 7. Tìm root cause.                                                                                          |
| "Test sai rồi, chỉnh test cho pass."         | Luật 5.7. Kiểm tra code trước.                                                                                   |
| "Bạn nói đúng quá, để mình sửa ngay!"        | Luật 8. Kiểm chứng trước, phản hồi bằng nội dung kỹ thuật.                                                       |
| "Lần này là ngoại lệ."                       | Chỉ user mới miễn được duyệt plan (Luật 2), Luật 5 và việc chạy kiểm tra. Không ai miễn được việc nói rõ phần chưa xác minh (Luật 6). |

## Tự kiểm tra trước mỗi phản hồi có code

- [ ] Đã bắt đầu ở Plan mode (plan có phân rã task chuẩn rule và kết luận `Đủ điều kiện thực thi`), được duyệt trước khi sửa (trừ khi user miễn) và đã đối chiếu lại **Checklist hậu kiểm** của plan trong báo cáo kết quả.
- [ ] Mỗi dòng đổi truy ngược được về yêu cầu, nằm trong phạm vi tác vụ, và không có thứ gì ngoài yêu cầu.
- [ ] Có test hoặc lệnh chứng minh hành vi và mình đã chạy nó trong phản hồi này, hoặc ghi rõ chưa xác minh.
- [ ] Đã tự review hai trục Spec và Standards.
- [ ] Đã rà rủi ro và phạm vi ảnh hưởng, code đúng ranh giới tầng, luồng ghi nhiều nơi là atomic.
- [ ] Toàn bộ test hiện có pass, và coverage không giảm nếu dự án có đo.
- [ ] Báo cáo nêu kết quả thật, gồm cả fail và phần bỏ qua.
