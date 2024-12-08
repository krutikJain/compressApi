const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const upload = multer({ dest: os.tmpdir() }); // Temporary directory for uploads

// Define supported formats
const SUPPORTED_FORMATS = ['mp4', 'mkv', 'mov', 'avi', 'flv', 'webm', 'wmv'];

// Helper function to get file extension
const getFileExtension = (filename) => filename.split('.').pop().toLowerCase();

// Compress video endpoint
app.post('/compress-video', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }

    const inputFilePath = req.file.path;
    const fileExtension = getFileExtension(req.file.originalname);

    // Check if the file format is supported
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
        fs.unlinkSync(inputFilePath); // Cleanup input file
        return res.status(400).json({
            error: `Format '${fileExtension}' not supported. Supported formats are: ${SUPPORTED_FORMATS.join(', ')}`,
        });
    }

    const outputFilePath = path.join(os.tmpdir(), `${Date.now()}-compressed.mp4`);

    // Start the compression
    ffmpeg(inputFilePath)
        .output(outputFilePath)
        .videoCodec('libx264') // Codec for high compression and compatibility
        .outputOptions([
            '-crf 30', // Slightly higher CRF for better compression with older FFmpeg
            '-preset ultrafast', // Use ultrafast preset for better compatibility
            '-strict -2', // Relax strictness for older versions
        ])
        .on('start', (commandLine) => {
            console.log('FFmpeg process started:', commandLine); // Log FFmpeg command
        })
        .on('progress', (progress) => {
            console.log('Processing:', progress); // Log progress
        })
        .on('end', () => {
            console.log('Compression finished successfully');
            res.download(outputFilePath, 'compressed_video.mp4', (err) => {
                fs.unlinkSync(inputFilePath); // Cleanup input file
                fs.unlinkSync(outputFilePath); // Cleanup output file
                if (err) {
                    console.error('Error sending compressed file:', err);
                    res.status(500).send({ error: 'Error sending compressed video' });
                }
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg Error:', err.message); // Log detailed FFmpeg error
            fs.unlinkSync(inputFilePath); // Cleanup input file
            if (fs.existsSync(outputFilePath)) {
                fs.unlinkSync(outputFilePath); // Cleanup output file if it exists
            }
            res.status(500).json({ error: 'Error compressing video.', details: err.message });
        })
        .run();
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
server.timeout = 300000; 