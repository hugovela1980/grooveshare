///////////////
// app-router
//////////////
function createAppRouter({ appElement }) {
    let currentRoute = 'initial screen';

    function getCurrentScreen() {
        return currentRoute.screen;
    }
    
    function renderCurrentScreen() {
        appElement.innerHTML = 
            `appElement markup for ${currentRoute.screen}`;

        console.log(`writing ${appElement.innerHTML}`);
    }

    function getRequestedRoute() {
        return { screen: 'INITIAL PAGE' }
    }

    function start(route = getRequestedRoute()) {
        currentRoute = route;
        renderCurrentScreen();
    }

    return { start, getRequestedRoute, getCurrentScreen };
}


//////////
// app
/////////
function createApp({ appElement }) {
    let activePageCleanup = null;

    const router = createAppRouter({ appElement });
    
    function initializeCurrentPage({ appElement, currentScreen }) {
        if (currentScreen === "INITIAL PAGE") {
            console.log(`${currentScreen} initialized.'`);

            return null;
        }
    }
    
    function initializeRenderedPage() {
        activePageCleanup =
            initializeCurrentPage({ 
                appElement,
                currentScreen: router.getCurrentScreen()
            });
    }

    function start() {
        const requestedRoute =
            router.getRequestedRoute();
        router.start(requestedRoute);
        initializeRenderedPage();
    }

    return { start };
}

//////////
// main
/////////
const appElement = {
    innerHTML: ""
}

const app = createApp({ appElement });

app.start();