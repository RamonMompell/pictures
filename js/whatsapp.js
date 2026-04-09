/* ===== DentalPix - WhatsApp Integration ===== */
/* Deep links, message formatting, and command system */

const WhatsApp = {
    // Format phone number for wa.me links
    formatPhone(phone) {
        // Remove spaces, dashes, parentheses
        let clean = phone.replace(/[\s\-\(\)]/g, '');
        // Ensure starts with country code
        if (clean.startsWith('00')) {
            clean = '+' + clean.substring(2);
        }
        if (!clean.startsWith('+')) {
            // Default to Spain if no country code
            clean = '+34' + clean;
        }
        // Remove the + for wa.me format
        return clean.replace('+', '');
    },

    // Build WhatsApp deep link
    buildLink(phone, message) {
        const formattedPhone = this.formatPhone(phone);
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    },

    // Build WhatsApp share link (without phone - share dialog)
    buildShareLink(message) {
        const encodedMessage = encodeURIComponent(message);
        return `https://wa.me/?text=${encodedMessage}`;
    },

    // Format message template with variables
    formatMessage(template, vars = {}) {
        let msg = template;
        for (const [key, value] of Object.entries(vars)) {
            msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return msg;
    },

    // Open WhatsApp with message
    openChat(phone, message) {
        const link = this.buildLink(phone, message);
        window.open(link, '_blank');
    },

    // Open WhatsApp share dialog
    shareMessage(message) {
        const link = this.buildShareLink(message);
        window.open(link, '_blank');
    },

    // Share image via Web Share API (if supported)
    async shareImage(blob, filename, text) {
        if (navigator.share && navigator.canShare) {
            const file = new File([blob], filename, { type: blob.type });
            const shareData = { files: [file], text };

            if (navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                    return true;
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        console.error('Share failed:', e);
                    }
                    return false;
                }
            }
        }
        return false;
    },

    // Prepare and send template via WhatsApp
    async sendTemplate(canvas, patient, messageTemplate, settings = {}) {
        const clinicName = settings.clinicName || 'nuestra clinica';
        const message = this.formatMessage(messageTemplate, {
            nombre: patient.name,
            clinica: clinicName,
            telefono: settings.clinicPhone || '',
            web: settings.clinicWeb || ''
        });

        // Try Web Share API first (supports images)
        const blob = await TemplateEngine.exportToBlob(canvas);
        const filename = `${patient.name.replace(/\s+/g, '_')}_plantilla.png`;
        const shared = await this.shareImage(blob, filename, message);

        if (!shared) {
            // Fallback: Download image + open WhatsApp chat
            await TemplateEngine.downloadTemplate(canvas, patient.name.replace(/\s+/g, '_'));

            if (patient.phone) {
                this.openChat(patient.phone, message + '\n\n(Adjunta la imagen descargada)');
            } else {
                this.shareMessage(message + '\n\n(Adjunta la imagen descargada)');
            }
        }

        // Log the send
        Storage.addSendHistory({
            patientName: patient.name,
            patientId: patient.id,
            phone: patient.phone || '',
            type: 'template',
            message: message.substring(0, 100)
        });

        return true;
    },

    // ---- Command System ----
    // Parse a command (patient name) and find matching patients
    executeCommand(query) {
        const patients = Storage.searchPatients(query);
        return {
            query,
            results: patients,
            found: patients.length > 0
        };
    },

    // Generate quick action for command result
    async quickAction(patient, actionType = 'initial') {
        const initialPhotos = await Storage.getPhotos(patient.id, 'initial');
        const finalPhotos = await Storage.getPhotos(patient.id, 'final');

        return {
            patient,
            initialPhotos,
            finalPhotos,
            hasInitial: initialPhotos.length > 0,
            hasFinal: finalPhotos.length > 0,
            suggestedAction: actionType
        };
    },

    // Get default messages based on type
    getDefaultMessage(type, settings = {}) {
        const defaults = {
            initial: settings.msgInitial || 'Hola {nombre}, estas son las fotos del inicio de tu tratamiento en {clinica}. Estamos encantados de acompanarte en este proceso.',
            final: settings.msgFinal || 'Hola {nombre}, mira los increibles resultados de tu tratamiento en {clinica}! Estamos muy contentos con tu progreso.',
            comparison: settings.msgComparison || 'Hola {nombre}, observa tu increible transformacion con {clinica}! Antes y despues de tu tratamiento.'
        };
        return defaults[type] || defaults.initial;
    }
};
