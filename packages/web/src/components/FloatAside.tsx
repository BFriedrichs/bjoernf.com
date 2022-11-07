import { FunctionalComponent, VNode } from 'preact';
import React from 'react';

type FloatAsideProps = {
  menu: VNode | null;
  hideMenu?: boolean;
  left?: boolean;
};

const FloatAside: FunctionalComponent<FloatAsideProps> = ({
  children,
  menu,
  hideMenu,
  left = true,
}) => {
  return (
    <div className="flex h-auto flex-col">
      <div
        className={`lg:sticky lg:top-4 lg:h-0 lg:w-52 lg:gap-12 ${
          left ? 'lg:l-0 lg:-translate-x-64' : 'lg:translate-x-64 lg:self-end'
        } mb-2 ${hideMenu ? 'hidden' : ''}`}
      >
        {menu}
      </div>
      {children}
    </div>
  );
};

export default FloatAside;