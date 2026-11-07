const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { handleAI } = require('./aiHandler');

const execFileAsync = promisify(execFile);
const ffmpegPath = require('ffmpeg-static');

const WHISPER_BIN   = path.join(__dirname, '../../../whisper/bin/whisper-cli.exe');
const WHISPER_THREADS = String(Math.max(1, (os.cpus().length || 2) - 1));

// turbo -> ggml-large-v3-turbo.bin; medium -> ggml-medium.bin; large-v3 -> ggml-large-v3.bin
const MODEL_KEY = process.env.WHISPER_MODEL || 'large-v3-turbo';
const WHISPER_MODEL = path.join(__dirname, `../../../whisper/models/ggml-${MODEL_KEY}.bin`);

function whisperReady() {
  return fs.existsSync(WHISPER_BIN) && fs.existsSync(WHISPER_MODEL);
}

if (!whisperReady()) {
  console.warn('[voice] Whisper не налаштовано. Запустіть: powershell -ExecutionPolicy Bypass -File scripts\\setup-whisper.ps1 -Model turbo');
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function convertToWav(inputPath, outputPath) {
  await execFileAsync(ffmpegPath, [
    '-y', '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-f', 'wav',
    outputPath,
  ]);
}

async function transcribeAudio(audioBuffer) {
  const id = Date.now();
  const tmpOgg = path.join(os.tmpdir(), `voice_in_${id}.ogg`);
  const tmpWav = path.join(os.tmpdir(), `voice_out_${id}.wav`);

  try {
    fs.writeFileSync(tmpOgg, audioBuffer);
    await convertToWav(tmpOgg, tmpWav);

    const { stdout } = await execFileAsync(
      WHISPER_BIN,
      [
        '-m', WHISPER_MODEL,
        '-f', tmpWav,
        '-l', 'uk',
        '-nt',            // без таймстемпів
        '-t', WHISPER_THREADS,
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 300_000 }
    );

    return stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== '[BLANK_AUDIO]' && !l.startsWith('['))
      .join(' ')
      .trim();
  } finally {
    fs.unlink(tmpOgg, () => {});
    fs.unlink(tmpWav, () => {});
  }
}

async function handleVoice(ctx, user) {
  if (!whisperReady()) {
    return ctx.reply(
      '⚙️ Розпізнавання голосу не налаштовано.\n\n' +
      'Запустіть у терміналі:\n' +
      '`powershell -ExecutionPolicy Bypass -File scripts\\setup-whisper.ps1 -Model turbo`\n\n' +
      'Або напишіть текстом.',
      { parse_mode: 'Markdown' }
    );
  }

  const voice = ctx.message.voice;

  try {
    const processingMsg = await ctx.reply('🎙️ Розпізнаю...');

    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const audioBuffer = await fetchBuffer(fileLink.href);
    const transcribed = await transcribeAudio(audioBuffer);

    ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

    if (!transcribed) {
      return ctx.reply('Не вдалося розпізнати голосове повідомлення. Спробуйте написати текстом.');
    }

    await ctx.reply(`🎙️ _${transcribed}_`, { parse_mode: 'Markdown' });
    ctx.message.text = transcribed;
    await handleAI(ctx, user);
  } catch (err) {
    console.error('[voice] error:', err.message);
    await ctx.reply('Помилка при обробці голосового повідомлення. Напишіть текстом.');
  }
}

module.exports = { handleVoice };
