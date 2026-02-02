/* eslint-disable no-restricted-globals */
self.onmessage = (e) => {
    const { action, payload } = e.data;

    if (action === 'START') {
        if (self.timerInterval) clearInterval(self.timerInterval);

        const targetTime = new Date(payload.targetTime).getTime();

        self.timerInterval = setInterval(() => {
            const now = new Date().getTime();
            const diff = Math.ceil((targetTime - now) / 1000);

            // Send back the remaining time
            self.postMessage({ type: 'TICK', timeLeft: diff });

            if (diff <= 0) {
                // Timer finished
                self.postMessage({ type: 'DONE' });
                clearInterval(self.timerInterval);
            }
        }, 1000); // 1 second exact tick, unthrottled in worker
    }

    if (action === 'STOP') {
        if (self.timerInterval) clearInterval(self.timerInterval);
    }
};
