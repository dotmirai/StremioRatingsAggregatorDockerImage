import TagManager from 'react-gtm-module';

export const initGTM = () => {
    TagManager.initialize({
        gtmId: 'GTM-MQNNRX36',
        dataLayer: {
            app: 'ratings-pro',
            environment: import.meta.env.MODE
        },
    });
};
