// frontend/src/App.jsx
import { motion } from 'framer-motion';
import { FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { SiStremio } from "react-icons/si";
import RatingCard from './components/RatingCard';
import { addonConfig } from './config';
import showCase from './assets/showcase.png';
// Removed KoFiDialog import as it was commented out
// import { KoFiDialog } from 'react-kofi';
// import 'react-kofi/dist/styles.css';

// +++ ADD THESE IMPORTS +++
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
// ++++++++++++++++++++++++++

function App() {
  // Use a relative path for Vercel deployment, or configure backendUrl dynamically
  // Assuming the frontend and backend are served from the same Vercel deployment domain
  const manifestUrl = `/manifest.json`;
  // Or adjust addonConfig.backendUrl if needed: const manifestUrl = `${addonConfig.backendUrl}/manifest.json`;

  const handleCopy = () => {
    // Construct full URL for copying if needed, using window.location.origin
    const absoluteManifestUrl = new URL(manifestUrl, window.location.origin).href;
    navigator.clipboard.writeText(absoluteManifestUrl)
      .then(() => toast.success('Manifest URL copied!'))
      .catch(() => toast.error('Failed to copy URL'));
  };

  const handleStremioWeb = () => {
    const absoluteManifestUrl = new URL(manifestUrl, window.location.origin).href;
    window.open(`https://web.stremio.com/#/addons?addon=${encodeURIComponent(absoluteManifestUrl)}`, '_blank');
  };

  const handleStremioApp = () => {
    const absoluteManifestUrl = new URL(manifestUrl, window.location.origin).href;
    // Ensure the manifest URL uses https for the deeplink if deployed
    const deepLinkManifestUrl = absoluteManifestUrl.replace(/^http:\/\//i, 'https://://');
    const deepLink = deepLinkManifestUrl.replace(/^https?:\/\//i, 'stremio://');
    window.location.href = deepLink;
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* +++ ADD VERCEL COMPONENTS HERE +++ */}
      <Analytics />
      <SpeedInsights />
      {/* +++++++++++++++++++++++++++++++++ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-7xl mx-auto"
      >
        {/* ... (rest of your component remains the same) ... */}

        <div className="text-center mb-16">
          <motion.h1
            className="text-4xl sm:text-6xl font-bold mb-6 gradient-text"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            Ratings Aggregator
          </motion.h1>
          <motion.p
            className="text-xl text-gray-300 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Your all-in-one movie and TV show ratings aggregator for Stremio
          </motion.p>
        </div>

        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleCopy}
          >
            <FaCopy /> Copy URL
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleStremioWeb}
          >
            <FaExternalLinkAlt /> Stremio Web
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="button-gradient px-8 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold"
            onClick={handleStremioApp}
          >
            <SiStremio /> Open Stremio
          </motion.button>

          {/* <KoFiDialog ... /> */}
        </motion.div>

        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-center w-full">
            <img
              src={showCase}
              alt="Showcase"
              className="w-full max-w-sm h-auto rounded-lg shadow-lg"
            />
          </div>
        </motion.div>

        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {/* <h2 className="text-3xl font-bold mb-4">Why Ratings Aggregator ?</h2> */}
          {/* <p>...</p> */}
        </motion.div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <RatingCard
            title="Multiple Sources"
            description="Aggregate ratings from IMDb, TMDb, Metacritic, and more"
            icon="🎯"
          />
          <RatingCard
            title="Parent Guidance"
            description="Get age ratings and content warnings from Common Sense Media"
            icon="👶"
          />
          <RatingCard
            title="Content Warnings"
            description="Detailed content warnings from CringeMDB"
            icon="⚠️"
          />

        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <p className="text-gray-400">
            Version {addonConfig.version} • Made with ❤️ for Stremio
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;