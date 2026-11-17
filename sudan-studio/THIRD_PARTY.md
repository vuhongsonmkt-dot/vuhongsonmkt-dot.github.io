# Thư viện, mô hình và nguồn gốc

Bản chuyển đổi này dựa trên ứng dụng SuDan Video Studio Windows v5.3 do người dùng cung cấp. Gói ZIP gốc không có giấy phép nguồn mở riêng được xác định trong lần kiểm tra này; gói chuyển đổi không tự cấp lại quyền đối với thương hiệu hay mã nguồn gốc. Kiểm tra quyền phân phối trước khi đưa nội dung có bản quyền lên repository công khai.

## Thư viện kèm theo

- **@ffmpeg/ffmpeg 0.12.10**: MIT; giấy phép ở `vendor/ffmpeg/LICENSE.wrapper`. Nguồn: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10
- **@ffmpeg/core 0.12.6**: GPL-2.0-or-later, bản dựng FFmpeg có libx264/libass. Giấy phép GPL tại `vendor/ffmpeg/COPYING.GPLv2`, metadata npm tại `vendor/ffmpeg/PACKAGE.core.json`. Nguồn/bộ dựng tương ứng: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.6 ; https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.6/ffmpeg ; https://github.com/FFmpeg/FFmpeg . Bốn file `.part*.wasm` là phép chia byte của WASM gốc, không sửa mã nhị phân; `wasm-parts.json` quy định thứ tự ghép.
- **@xenova/transformers 2.17.2**: Apache-2.0, `vendor/LICENSE.transformers`; https://github.com/huggingface/transformers.js/tree/2.17.2 . Các NOTICE của thành phần nhúng có trong bundle.
- **ONNX Runtime Web 1.14.0**: MIT, `vendor/onnx/LICENSE`. WASM lấy từ bản phân phối @xenova/transformers 2.17.2 tương ứng bundle; https://github.com/microsoft/onnxruntime/tree/v1.14.0
- **DejaVu Sans**: giấy phép Bitstream Vera/DejaVu tại `assets/FONT-LICENSE.txt`; https://dejavu-fonts.github.io/ . Dùng để render dấu tiếng Việt bằng libass.

URL tải, phiên bản, kích thước và SHA-256 của các file phân phối được ghi trong `vendor/SOURCES.json`.

## Mô hình được tải theo yêu cầu (không kèm weights trong ZIP)

- **Xenova/whisper-tiny**, nguồn OpenAI Whisper: MIT. https://huggingface.co/Xenova/whisper-tiny ; https://github.com/openai/whisper
- **Xenova/nllb-200-distilled-600M**, nguồn Meta NLLB: CC-BY-NC-4.0 (phi thương mại). https://huggingface.co/Xenova/nllb-200-distilled-600M ; https://huggingface.co/facebook/nllb-200-distilled-600M
- **Xenova/mms-tts-vie**, nguồn Meta MMS: CC-BY-NC-4.0 (phi thương mại). https://huggingface.co/Xenova/mms-tts-vie ; https://huggingface.co/facebook/mms-tts-vie

Không thể đổi giấy phép của mô hình bằng cách đưa app lên GitHub. Quyền chạy thư viện, tải mô hình và dùng kết quả cần được xem theo giấy phép và model card tương ứng. Dùng đúng phiên bản có giấy phép phù hợp cho mục đích của bạn.
