import * as React from 'react';
import { connect } from 'react-redux';
import { withWeb3 } from 'react-web3-provider';
import { bindActionCreators, compose } from 'redux';
import * as modalsActions from '../../actions/modalsActions';
import * as web3Actions from '../../actions/web3Actions';
import * as Web3Utils from '../../utils/web3-utils';
import FaucetModal from '../FaucetModal';

export interface IProps {
  web3: any;
  setNitrogenBalance: (balance: number) => any;
  nitrogenBalance: number;
  toggleFaucetDialog: () => {};
}

class Header extends React.Component<IProps> {
  public componentDidMount() {
    // Get token balance on load
    this.updateTokenBalance();
  }
  public render() {
    const { nitrogenBalance, toggleFaucetDialog } = this.props;

    return (
      <div>
        <FaucetModal mintedCallback={this.updateTokenBalance} />
        <button className="jr-btn jr-btn-xs btn-secondary" id='NTN-button' onClick={toggleFaucetDialog}>
            NTN
            <span className="ml-2 mb-0 badge badge-primary">{nitrogenBalance}</span>
        </button>
      </div>
    );
  }
  private updateTokenBalance = () => {
    const { web3, setNitrogenBalance } = this.props;
    // Get current account address and use it to get the current Nitrogen token balance using
    // Web3Utils, then save the result to Redux
    Web3Utils.getDefaultAccount(web3).then(address => {
      Web3Utils.getNitrogenBalance(web3, address)
        .then((balance: number) => setNitrogenBalance(balance))
        .catch((balance: number) => setNitrogenBalance(0));
    }).catch((balance: number) => setNitrogenBalance(0));
  }
}

export default compose<any>(
  connect(
    state => ({
      nitrogenBalance: state.web3.nitrogenBalance
    }),
    dispatch => ({
      setNitrogenBalance: bindActionCreators(web3Actions.setNitrogenBalance, dispatch),
      toggleFaucetDialog: bindActionCreators(modalsActions.toggleFaucetDialog, dispatch)
    })
  ),
  withWeb3
)(Header);
