/* ===== DentalPix - Image Cropper & Processor ===== */
/* Auto-crop, enhance, and process dental images */

const ImageProcessor = {
    MAX_WIDTH: 1600,
    MAX_HEIGHT: 1200,
    JPEG_QUALITY: 0.85,

    // Process a single image file: resize, auto-crop, enhance
    async processImage(file, options = {}) {
        const {
            autoCrop = true,
            autoEnhance = true,
            maxWidth = this.MAX_WIDTH,
            maxHeight = this.MAX_HEIGHT
        } = options;

        const img = await this.loadImage(file);
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        // Step 1: Resize to max dimensions
        let { width, height } = this.fitDimensions(img.width, img.height, maxWidth, maxHeight);
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Step 2: Auto-crop (remove uniform borders)
        if (autoCrop) {
            const cropResult = this.autoCrop(canvas, ctx);
            if (cropResult) {
                const cropped = document.createElement('canvas');
                const croppedCtx = cropped.getContext('2d');
                cropped.width = cropResult.width;
                cropped.height = cropResult.height;
                croppedCtx.drawImage(
                    canvas,
                    cropResult.x, cropResult.y,
                    cropResult.width, cropResult.height,
                    0, 0,
                    cropResult.width, cropResult.height
                );
                canvas = cropped;
                ctx = croppedCtx;
            }
        }

        // Step 3: Auto-enhance (brightness, contrast)
        if (autoEnhance) {
            this.autoEnhance(canvas, ctx);
        }

        // Return as data URL
        const dataUrl = canvas.toDataURL('image/jpeg', this.JPEG_QUALITY);
        return {
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            originalName: file.name,
            wasCropped: autoCrop,
            wasEnhanced: autoEnhance
        };
    },

    // Load image from File object
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Error cargando imagen'));
            };
            img.src = url;
        });
    },

    // Load image from data URL
    loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Error cargando imagen'));
            img.src = url;
        });
    },

    // Calculate fitted dimensions maintaining aspect ratio
    fitDimensions(w, h, maxW, maxH) {
        if (w <= maxW && h <= maxH) return { width: w, height: h };
        const ratio = Math.min(maxW / w, maxH / h);
        return {
            width: Math.round(w * ratio),
            height: Math.round(h * ratio)
        };
    },

    // Auto-crop: detect and remove uniform borders
    autoCrop(canvas, ctx) {
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const THRESHOLD = 30; // Color difference threshold
        const EDGE_PERCENT = 0.02; // Minimum crop (2%)

        // Sample corners to determine border color
        const corners = [
            this.getPixel(data, width, 0, 0),
            this.getPixel(data, width, width - 1, 0),
            this.getPixel(data, width, 0, height - 1),
            this.getPixel(data, width, width - 1, height - 1)
        ];

        // Average corner color
        const bgColor = {
            r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
            g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
            b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4)
        };

        // Check if all corners are similar (indicates a border)
        const cornersMatch = corners.every(c =>
            Math.abs(c.r - bgColor.r) < THRESHOLD &&
            Math.abs(c.g - bgColor.g) < THRESHOLD &&
            Math.abs(c.b - bgColor.b) < THRESHOLD
        );

        if (!cornersMatch) return null;

        // Find crop boundaries
        let top = 0, bottom = height - 1, left = 0, right = width - 1;

        // Scan from top
        for (let y = 0; y < height; y++) {
            let isBackground = true;
            for (let x = 0; x < width; x += 4) { // Sample every 4 pixels for speed
                const px = this.getPixel(data, width, x, y);
                if (this.colorDiff(px, bgColor) > THRESHOLD) {
                    isBackground = false;
                    break;
                }
            }
            if (!isBackground) { top = y; break; }
        }

        // Scan from bottom
        for (let y = height - 1; y >= 0; y--) {
            let isBackground = true;
            for (let x = 0; x < width; x += 4) {
                const px = this.getPixel(data, width, x, y);
                if (this.colorDiff(px, bgColor) > THRESHOLD) {
                    isBackground = false;
                    break;
                }
            }
            if (!isBackground) { bottom = y; break; }
        }

        // Scan from left
        for (let x = 0; x < width; x++) {
            let isBackground = true;
            for (let y = top; y <= bottom; y += 4) {
                const px = this.getPixel(data, width, x, y);
                if (this.colorDiff(px, bgColor) > THRESHOLD) {
                    isBackground = false;
                    break;
                }
            }
            if (!isBackground) { left = x; break; }
        }

        // Scan from right
        for (let x = width - 1; x >= 0; x--) {
            let isBackground = true;
            for (let y = top; y <= bottom; y += 4) {
                const px = this.getPixel(data, width, x, y);
                if (this.colorDiff(px, bgColor) > THRESHOLD) {
                    isBackground = false;
                    break;
                }
            }
            if (!isBackground) { right = x; break; }
        }

        // Add small padding
        const padX = Math.round(width * 0.005);
        const padY = Math.round(height * 0.005);
        top = Math.max(0, top - padY);
        left = Math.max(0, left - padX);
        bottom = Math.min(height - 1, bottom + padY);
        right = Math.min(width - 1, right + padX);

        const cropWidth = right - left + 1;
        const cropHeight = bottom - top + 1;

        // Only crop if we're removing at least EDGE_PERCENT
        if (cropWidth >= width * (1 - EDGE_PERCENT * 2) &&
            cropHeight >= height * (1 - EDGE_PERCENT * 2)) {
            return null;
        }

        return { x: left, y: top, width: cropWidth, height: cropHeight };
    },

    // Get pixel at position
    getPixel(data, width, x, y) {
        const idx = (y * width + x) * 4;
        return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    },

    // Color difference (Euclidean)
    colorDiff(c1, c2) {
        return Math.sqrt(
            (c1.r - c2.r) ** 2 +
            (c1.g - c2.g) ** 2 +
            (c1.b - c2.b) ** 2
        );
    },

    // Auto-enhance brightness and contrast
    autoEnhance(canvas, ctx) {
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Analyze histogram
        let minBright = 255, maxBright = 0;
        let totalBright = 0;
        const sampleStep = 8; // Sample every 8 pixels for speed

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
            const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            if (brightness < minBright) minBright = brightness;
            if (brightness > maxBright) maxBright = brightness;
            totalBright += brightness;
        }

        const avgBright = totalBright / (data.length / (4 * sampleStep));
        const range = maxBright - minBright;

        // Only enhance if the image needs it
        if (range > 200 && avgBright > 80 && avgBright < 180) return;

        // Calculate subtle adjustments
        const contrastFactor = range < 180 ? 1.1 : 1.0;
        const brightnessAdjust = avgBright < 100 ? 15 : (avgBright > 180 ? -10 : 0);

        if (contrastFactor === 1.0 && brightnessAdjust === 0) return;

        // Apply adjustments
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                let val = data[i + c];
                // Contrast
                val = ((val - 128) * contrastFactor) + 128;
                // Brightness
                val += brightnessAdjust;
                data[i + c] = Math.max(0, Math.min(255, Math.round(val)));
            }
        }

        ctx.putImageData(imageData, 0, 0);
    },

    // Create a thumbnail
    async createThumbnail(dataUrl, size = 200) {
        const img = await this.loadImageFromUrl(dataUrl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Square crop from center
        const srcSize = Math.min(img.width, img.height);
        const srcX = (img.width - srcSize) / 2;
        const srcY = (img.height - srcSize) / 2;

        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

        return canvas.toDataURL('image/jpeg', 0.8);
    },

    // Batch process multiple files
    async processFiles(files, options = {}, onProgress = null) {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            try {
                const result = await this.processImage(files[i], options);
                results.push(result);
                if (onProgress) onProgress(i + 1, files.length, result);
            } catch (err) {
                console.error(`Error processing ${files[i].name}:`, err);
                results.push({ error: err.message, originalName: files[i].name });
            }
        }
        return results;
    }
};
