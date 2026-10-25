let io = null;

function attach(serverIo) {
  io = serverIo;
}

function broadcastExamSettings(examId, settings, message, adminName) {
  if (!io) return;
  io.to(`exam:${examId}`).emit('exam:settings', {
    examId,
    settings,
    message,
    adminName,
    at: Date.now()
  });
}

function broadcastAttemptPatch(attemptId, examId, patch, message) {
  if (!io) return;
  io.to(`attempt:${attemptId}`).emit('attempt:patch', {
    attemptId,
    examId,
    patch,
    message,
    at: Date.now()
  });
}

function bind(ioInstance) {
  io = ioInstance;
  io.on('connection', (socket) => {
    socket.on('join', ({ examId, attemptId }) => {
      if (examId) socket.join(`exam:${examId}`);
      if (attemptId) socket.join(`attempt:${attemptId}`);
    });
    socket.on('leave', ({ examId, attemptId }) => {
      if (examId) socket.leave(`exam:${examId}`);
      if (attemptId) socket.leave(`attempt:${attemptId}`);
    });
  });
}

module.exports = { attach, bind, broadcastExamSettings, broadcastAttemptPatch };
