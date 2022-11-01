import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { ToastContainer } from 'react-toast';

import * as ackeeTracker from 'app/lib/ackee';
import NotFound from 'app/pages/404';
import About from 'app/pages/about/About';
import Blog from 'app/pages/blog/Blog';
import Post from 'app/pages/blog/Post';
import Home from 'app/pages/home/Home';
import Projects from 'app/pages/projects/Projects';
const Admin = React.lazy(() => import('app/pages/admin/Admin'));
import RequestProvider from 'app/providers/RequestProvider';
import { isSSR } from 'app/util';

import Footer from 'app/components/Footer';
import Header from 'app/components/Header';
import NavigationButtons from 'app/components/NavigationButtons';

const SSRSupport = ({ ssr, children }) => {
  return <StaticRouter location={ssr.url}>{children}</StaticRouter>;
};

const RouterLayer = isSSR ? SSRSupport : BrowserRouter;

const HistoryLayer = ({ children }) => {
  const location = useLocation();

  const [tracking] = useState(
    ackeeTracker.create('https://dashboard.bjornf.dev', {
      ignoreLocalhost: true,
      detailed: true,
    })
  );

  useEffect(() => {
    if (!isSSR) {
      const path = location.pathname;
      let title = '';
      if (path === '/') {
        title = 'Home';
      } else {
        const firstItem = path.split('/')[1];
        title = firstItem.charAt(0).toUpperCase() + firstItem.slice(1);
      }

      document.title = `${title} - Björn Friedrichs`;
      tracking.record('2a5590d3-ef8c-45ab-9b29-7f14459e092f');
    }
  }, [location]);

  return children;
};

const App = (props) => {
  return (
    <div className="flex flex-1 bg-default">
      <RequestProvider>
        <RouterLayer ssr={props.ssr}>
          <HistoryLayer>
            <div className="flex flex-1 flex-col">
              <div className="smo:pr0 ml-auto mr-auto box-border flex w-full flex-1 flex-col md:max-w-[700px] smo:pl-0">
                <div className="flex flex-1 flex-col">
                  <Header />
                  <div
                    className="flex flex-1 flex-col px-1 py-11"
                    style={{ maxWidth: '100vw' }}
                  >
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/blog/:id" element={<Post />} />
                      <Route path="/blog/:id/edit" element={<Post />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/about" element={<About />} />
                      <Route
                        path="/admin"
                        element={
                          <Suspense fallback={<div>Loading...</div>}>
                            <Admin />
                          </Suspense>
                        }
                      />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                  <Footer />
                  <NavigationButtons mobile />
                </div>
              </div>
            </div>
          </HistoryLayer>
        </RouterLayer>
      </RequestProvider>
      <ToastContainer position="top-center" delay={1000} />
    </div>
  );
};

export default App;
