import url from 'url';
import { createRunner } from '@puppeteer/replay';

export async function run(extension) {
    const runner = await createRunner(extension);

    await runner.runBeforeAllSteps();

    await runner.runStep({
        type: 'setViewport',
        width: 1289,
        height: 1271,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: false
    });
    await runner.runStep({
        type: 'navigate',
        url: 'https://35972460-91c6-42dd-92bc-da912b0e3609-00-1drcd7m558rz7.worf.replit.dev/',
        assertedEvents: [
            {
                type: 'navigation',
                url: 'https://35972460-91c6-42dd-92bc-da912b0e3609-00-1drcd7m558rz7.worf.replit.dev/',
                title: 'Kerzenwelt by Dani | Handgemachte Kerzen'
            }
        ]
    });
    await runner.runStep({
        type: 'click',
        target: 'main',
        selectors: [
            [
                'section:nth-of-type(2) div.grid > div:nth-of-type(1) a'
            ],
            [
                'xpath///*[@id="root"]/div[2]/main/section[2]/div/div[2]/div[1]/div/div/a'
            ],
            [
                'pierce/section:nth-of-type(2) div.grid > div:nth-of-type(1) a'
            ]
        ],
        offsetY: 15.203125,
        offsetX: 77.5,
    });

    await runner.runAfterAllSteps();
}

if (process && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    run()
}
