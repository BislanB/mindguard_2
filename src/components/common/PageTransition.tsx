import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export function PageTransition({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [displayChildren, setDisplayChildren] = useState(children);
    const [transitionStage, setTransitionStage] = useState('enter');
    const prevPath = useRef(location.pathname);

    useEffect(() => {
        if (location.pathname !== prevPath.current) {
            setTransitionStage('exit');
            setTimeout(() => {
                setDisplayChildren(children);
                setTransitionStage('enter');
                prevPath.current = location.pathname;
            }, 150);
        } else {
            setDisplayChildren(children);
        }
    }, [location.pathname, children]);

    return (
        <div className={`page-transition page-transition--${transitionStage}`}>
            {displayChildren}
        </div>
    );
}
