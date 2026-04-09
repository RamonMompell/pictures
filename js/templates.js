/* ===== DentalPix - Template Engine ===== */
/* Canvas-based template rendering with multiple layouts */

const TemplateEngine = {
    // Template definitions with layout configs
    layouts: {
        classic: {
            name: 'Clasico 2x2',
            cols: 2,
            rows: 2,
            maxPhotos: 4,
            render: 'grid'
        },
        modern: {
            name: 'Moderno',
            maxPhotos: 4,
            render: 'modern'
        },
        elegant: {
            name: 'Elegante',
            maxPhotos: 3,
            render: 'elegant'
        },
        grid3: {
            name: 'Cuadricula 3x2',
            cols: 3,
            rows: 2,
            maxPhotos: 6,
            render: 'grid'
        },
        beforeafter: {
            name: 'Antes/Despues',
            maxPhotos: 2,
            render: 'beforeafter'
        },
        panoramic: {
            name: 'Panoramico',
            maxPhotos: 3,
            render: 'panoramic'
        }
    },

    // Main render function
    async render(canvas, options) {
        const ctx = canvas.getContext('2d');
        const {
            layout = 'classic',
            photos = [],
            bgColor = '#1a1a2e',
            textColor = '#ffffff',
            borderRadius = 8,
            title = '',
            subtitle = '',
            logoDataUrl = null,
            clinicName = '',
            type = 'initial' // initial, final, comparison
        } = options;

        const W = canvas.width;
        const H = canvas.height;
        const PADDING = 30;
        const HEADER_H = title ? 80 : 40;
        const FOOTER_H = 50;

        // Clear canvas
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        // Draw subtle gradient overlay
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, 'rgba(255,255,255,0.02)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Draw header
        let headerY = PADDING;

        // Logo
        if (logoDataUrl) {
            try {
                const logoImg = await ImageProcessor.loadImageFromUrl(logoDataUrl);
                const logoH = 40;
                const logoW = (logoImg.width / logoImg.height) * logoH;
                ctx.drawImage(logoImg, PADDING, headerY, logoW, logoH);
            } catch (e) { /* logo load failed, skip */ }
        }

        // Type badge
        const badgeText = type === 'initial' ? 'INICIAL' :
                          type === 'final' ? 'FINAL' :
                          'ANTES / DESPUES';
        const badgeColor = type === 'initial' ? '#4a90d9' :
                           type === 'final' ? '#00b894' :
                           '#f39c12';

        ctx.fillStyle = badgeColor;
        const badgeW = ctx.measureText(badgeText).width || 80;
        this.roundRect(ctx, W - PADDING - badgeW - 20, headerY + 8, badgeW + 20, 26, 13);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, W - PADDING - badgeW / 2 - 10, headerY + 25);
        ctx.textAlign = 'left';

        headerY += 48;

        // Title
        if (title) {
            ctx.fillStyle = textColor;
            ctx.font = 'bold 24px -apple-system, sans-serif';
            ctx.fillText(title, PADDING, headerY + 4);
            headerY += 28;
        }

        // Subtitle
        if (subtitle) {
            ctx.fillStyle = this.adjustAlpha(textColor, 0.7);
            ctx.font = '14px -apple-system, sans-serif';
            ctx.fillText(subtitle, PADDING, headerY + 4);
            headerY += 20;
        }

        headerY += 10;

        // Photo area
        const photoAreaY = headerY;
        const photoAreaH = H - photoAreaY - FOOTER_H;
        const photoAreaW = W - PADDING * 2;

        // Load all photo images
        const images = [];
        for (const photo of photos) {
            try {
                const img = await ImageProcessor.loadImageFromUrl(photo.dataUrl || photo);
                images.push(img);
            } catch (e) {
                images.push(null);
            }
        }

        // Render based on layout type
        const layoutConfig = this.layouts[layout];
        if (layoutConfig) {
            switch (layoutConfig.render) {
                case 'grid':
                    this.renderGrid(ctx, images, PADDING, photoAreaY, photoAreaW, photoAreaH, layoutConfig.cols, layoutConfig.rows, borderRadius);
                    break;
                case 'modern':
                    this.renderModern(ctx, images, PADDING, photoAreaY, photoAreaW, photoAreaH, borderRadius);
                    break;
                case 'elegant':
                    this.renderElegant(ctx, images, PADDING, photoAreaY, photoAreaW, photoAreaH, borderRadius);
                    break;
                case 'beforeafter':
                    this.renderBeforeAfter(ctx, images, PADDING, photoAreaY, photoAreaW, photoAreaH, borderRadius, textColor);
                    break;
                case 'panoramic':
                    this.renderPanoramic(ctx, images, PADDING, photoAreaY, photoAreaW, photoAreaH, borderRadius);
                    break;
            }
        }

        // Draw footer
        const footerY = H - FOOTER_H + 10;
        ctx.fillStyle = this.adjustAlpha(textColor, 0.3);
        ctx.font = '11px -apple-system, sans-serif';

        if (clinicName) {
            ctx.textAlign = 'left';
            ctx.fillText(clinicName, PADDING, footerY + 14);
        }

        ctx.textAlign = 'right';
        const dateStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
        ctx.fillText(dateStr, W - PADDING, footerY + 14);

        ctx.textAlign = 'center';
        ctx.fillStyle = this.adjustAlpha(textColor, 0.15);
        ctx.font = '9px -apple-system, sans-serif';
        ctx.fillText('DentalPix', W / 2, H - 8);

        ctx.textAlign = 'left';

        Storage.incrementTemplateCount();
        Storage.addActivity('template', `Plantilla "${layout}" generada`);
    },

    // ---- Layout Renderers ----

    renderGrid(ctx, images, x, y, w, h, cols, rows, radius) {
        const gap = 10;
        const cellW = (w - gap * (cols - 1)) / cols;
        const cellH = (h - gap * (rows - 1)) / rows;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const idx = row * cols + col;
                const cx = x + col * (cellW + gap);
                const cy = y + row * (cellH + gap);

                // Draw cell background
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                this.roundRect(ctx, cx, cy, cellW, cellH, radius);
                ctx.fill();

                if (images[idx]) {
                    this.drawImageCover(ctx, images[idx], cx, cy, cellW, cellH, radius);
                } else {
                    // Empty cell placeholder
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                    ctx.lineWidth = 1;
                    this.roundRect(ctx, cx, cy, cellW, cellH, radius);
                    ctx.stroke();
                    // Draw photo icon
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.font = '24px -apple-system, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('+', cx + cellW / 2, cy + cellH / 2 + 8);
                    ctx.textAlign = 'left';
                }
            }
        }
    },

    renderModern(ctx, images, x, y, w, h, radius) {
        const gap = 10;
        // Top: 1 large image spanning full width (60% height)
        const topH = h * 0.58;
        const bottomH = h - topH - gap;

        // Top image
        if (images[0]) {
            this.drawImageCover(ctx, images[0], x, y, w, topH, radius);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this.roundRect(ctx, x, y, w, topH, radius);
            ctx.fill();
        }

        // Bottom: 3 equal images
        const bottomCols = 3;
        const cellW = (w - gap * (bottomCols - 1)) / bottomCols;
        for (let i = 0; i < bottomCols; i++) {
            const cx = x + i * (cellW + gap);
            const cy = y + topH + gap;
            if (images[i + 1]) {
                this.drawImageCover(ctx, images[i + 1], cx, cy, cellW, bottomH, radius);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                this.roundRect(ctx, cx, cy, cellW, bottomH, radius);
                ctx.fill();
            }
        }
    },

    renderElegant(ctx, images, x, y, w, h, radius) {
        const gap = 10;
        // Left: 1 tall image (55% width)
        const leftW = w * 0.55;
        const rightW = w - leftW - gap;

        // Left image
        if (images[0]) {
            this.drawImageCover(ctx, images[0], x, y, leftW, h, radius);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this.roundRect(ctx, x, y, leftW, h, radius);
            ctx.fill();
        }

        // Right: 2 stacked images
        const rightCellH = (h - gap) / 2;
        for (let i = 0; i < 2; i++) {
            const cx = x + leftW + gap;
            const cy = y + i * (rightCellH + gap);
            if (images[i + 1]) {
                this.drawImageCover(ctx, images[i + 1], cx, cy, rightW, rightCellH, radius);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                this.roundRect(ctx, cx, cy, rightW, rightCellH, radius);
                ctx.fill();
            }
        }
    },

    renderBeforeAfter(ctx, images, x, y, w, h, radius, textColor) {
        const gap = 20;
        const dividerW = 4;
        const cellW = (w - gap * 2 - dividerW) / 2;

        // Before image
        if (images[0]) {
            this.drawImageCover(ctx, images[0], x, y, cellW, h, radius);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this.roundRect(ctx, x, y, cellW, h, radius);
            ctx.fill();
        }

        // Divider
        const divX = x + cellW + gap;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.roundRect(ctx, divX, y + 20, dividerW, h - 40, 2);
        ctx.fill();

        // Arrow
        ctx.fillStyle = textColor;
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('→', divX + dividerW / 2, y + h / 2 + 7);
        ctx.textAlign = 'left';

        // After image
        const afterX = divX + dividerW + gap;
        if (images[1]) {
            this.drawImageCover(ctx, images[1], afterX, y, cellW, h, radius);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this.roundRect(ctx, afterX, y, cellW, h, radius);
            ctx.fill();
        }

        // Labels
        ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.textAlign = 'center';

        // "ANTES" label
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.roundRect(ctx, x + cellW / 2 - 30, y + h - 38, 60, 24, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('ANTES', x + cellW / 2, y + h - 22);

        // "DESPUES" label
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.roundRect(ctx, afterX + cellW / 2 - 38, y + h - 38, 76, 24, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('DESPUES', afterX + cellW / 2, y + h - 22);

        ctx.textAlign = 'left';
    },

    renderPanoramic(ctx, images, x, y, w, h, radius) {
        const gap = 10;
        // Top: panoramic (full width, 55% height)
        const topH = h * 0.55;
        const bottomH = h - topH - gap;

        if (images[0]) {
            this.drawImageCover(ctx, images[0], x, y, w, topH, radius);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this.roundRect(ctx, x, y, w, topH, radius);
            ctx.fill();
        }

        // Bottom: 2 images
        const cellW = (w - gap) / 2;
        for (let i = 0; i < 2; i++) {
            const cx = x + i * (cellW + gap);
            const cy = y + topH + gap;
            if (images[i + 1]) {
                this.drawImageCover(ctx, images[i + 1], cx, cy, cellW, bottomH, radius);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                this.roundRect(ctx, cx, cy, cellW, bottomH, radius);
                ctx.fill();
            }
        }
    },

    // ---- Drawing Helpers ----

    // Draw image with cover mode (fill area, crop excess) with rounded corners
    drawImageCover(ctx, img, x, y, w, h, radius) {
        ctx.save();
        // Clip to rounded rect
        this.roundRect(ctx, x, y, w, h, radius);
        ctx.clip();

        // Calculate cover dimensions
        const imgRatio = img.width / img.height;
        const areaRatio = w / h;
        let drawW, drawH, drawX, drawY;

        if (imgRatio > areaRatio) {
            // Image is wider - crop sides
            drawH = h;
            drawW = h * imgRatio;
            drawX = x - (drawW - w) / 2;
            drawY = y;
        } else {
            // Image is taller - crop top/bottom
            drawW = w;
            drawH = w / imgRatio;
            drawX = x;
            drawY = y - (drawH - h) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
    },

    // Rounded rectangle path
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    // Adjust hex color alpha
    adjustAlpha(hexColor, alpha) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    },

    // Export canvas to blob
    async exportToBlob(canvas, format = 'image/png', quality = 0.92) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, format, quality);
        });
    },

    // Download template as file
    async downloadTemplate(canvas, filename = 'plantilla') {
        const blob = await this.exportToBlob(canvas);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
