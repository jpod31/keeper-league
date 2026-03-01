/**
 * Shepherd.js onboarding tour for new Keeper League users.
 */
(function() {
  if (typeof Shepherd === 'undefined') return;

  var tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: 'kl-tour-step',
      scrollTo: true,
      cancelIcon: { enabled: true },
      buttons: [
        { text: 'Skip Tour', action: function() { tour.complete(); }, secondary: true },
        { text: 'Next', action: function() { tour.next(); } }
      ]
    }
  });

  // Step 1: Welcome
  tour.addStep({
    id: 'welcome',
    title: 'Welcome to Keeper League!',
    text: 'This quick tour will show you around the key features. You can skip at any time.',
    buttons: [
      { text: 'Skip', action: function() { tour.complete(); }, secondary: true },
      { text: "Let's Go!", action: function() { tour.next(); } }
    ]
  });

  // Step 2: League selector
  var leagueSelector = document.querySelector('.league-selector-btn, .league-selector');
  if (leagueSelector) {
    tour.addStep({
      id: 'league-selector',
      title: 'Your Leagues',
      text: 'Switch between leagues or create/join new ones from this dropdown.',
      attachTo: { element: leagueSelector, on: 'bottom' },
    });
  }

  // Step 3: Navigation tabs
  var tabs = document.getElementById('league-tabs');
  if (tabs) {
    tour.addStep({
      id: 'nav-tabs',
      title: 'Navigation Tabs',
      text: 'Use these tabs to access your team, gameday scores, player pool, league fixtures, and more.',
      attachTo: { element: tabs, on: 'bottom' },
    });
  }

  // Step 4: My Team
  var myTeamTab = document.querySelector('.league-tab[href*="/team/"]');
  if (myTeamTab) {
    tour.addStep({
      id: 'my-team',
      title: 'My Team',
      text: 'View your squad in field or table layout. Set your captain, manage your lineup, and check player stats.',
      attachTo: { element: myTeamTab, on: 'bottom' },
    });
  }

  // Step 5: Gameday
  var gamedayTab = document.querySelector('.league-tab[href*="/gameday"]');
  if (gamedayTab) {
    tour.addStep({
      id: 'gameday',
      title: 'Gameday',
      text: 'Track live scores head-to-head against your opponent during AFL game days.',
      attachTo: { element: gamedayTab, on: 'bottom' },
    });
  }

  // Step 6: Notifications
  var notifBell = document.getElementById('notifBell');
  if (notifBell) {
    tour.addStep({
      id: 'notifications',
      title: 'Notifications',
      text: 'You\'ll get real-time notifications for trades, messages, and league events.',
      attachTo: { element: notifBell, on: 'bottom' },
    });
  }

  // Step 7: Complete
  tour.addStep({
    id: 'complete',
    title: 'You\'re all set!',
    text: 'Explore your league and have fun! You can always find help in the Settings page.',
    buttons: [
      { text: 'Finish Tour', action: function() { tour.complete(); } }
    ]
  });

  // On complete, POST to mark onboarding done
  tour.on('complete', function() {
    var csrf = document.querySelector('meta[name="csrf-token"]');
    if (csrf) {
      fetch('/auth/onboarding/complete', {
        method: 'POST',
        headers: {'X-CSRFToken': csrf.getAttribute('content')}
      });
    }
  });

  tour.on('cancel', function() {
    var csrf = document.querySelector('meta[name="csrf-token"]');
    if (csrf) {
      fetch('/auth/onboarding/complete', {
        method: 'POST',
        headers: {'X-CSRFToken': csrf.getAttribute('content')}
      });
    }
  });

  // Start the tour
  tour.start();
})();
