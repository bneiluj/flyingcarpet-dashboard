import * as React from 'react';
import CurrentNetwork from './../CurrentNetwork';
import NTNBalance from './../NTNBalance';
import SearchBox from './../SearchBox';
import Web3Status from './../Web3Status';
import Menu from "./Menu";

class Header extends React.Component {
  public render() {
    return (
      <div className="app-main-header">
        <div className="d-flex app-toolbar align-items-center">
          <div className="app-logo-bl">
              {/* <div className="d-block d-md-none">
                  <span className="jr-menu-icon">
                      <span className="menu-icon"/>
                  </span>
              </div> */}
              <div className="app-logo pointer d-none d-md-block">
                  <img className="d-block d-lg-block" alt='...' src='/assets/images/logo.png'/>
                  <img className="d-none d-lg-none mr-3" alt='...'
                       src='http://via.placeholder.com/32x32'/>
              </div>
          </div>

          <SearchBox />

          <div><Menu/></div>

          <ul className="header-notifications list-inline ml-auto">
              <li className="list-inline-item user-nav">
                <Web3Status />
              </li>
              <li className="list-inline-item user-nav">
                <CurrentNetwork />
              </li>
              <li className="list-inline-item user-nav">
                <NTNBalance />
              </li>
          </ul>
        </div>
      </div>
    );
  }
}

export default Header;
