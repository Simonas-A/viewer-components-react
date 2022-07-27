/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React from "react";
import { Text, ComboBox, SelectOption } from "@itwin/itwinui-react";
import "./DropdownTile.scss";


interface DropdownTileProps {
  columnOptions: SelectOption<string>[];
  materialValue: string;
  quantityValue: string;
  onQuantityChange: (value: string) => void;
  onMaterialChange: (value: string) => void;
  actionGroup: ReactNode;
  //title: string;
  //button: ReactNode;
  //subText?: string;
  //onClickTitle?: () => void;
  //titleTooltip?: string;
  //subtextToolTip?: string;
}

export const DropdownTile = ({
  //title,
  //subText,
  //onClickTitle,
  //titleTooltip,
  //subtextToolTip,
  //button,
  columnOptions,
  materialValue,
  quantityValue,
  onQuantityChange,
  onMaterialChange,
  actionGroup,
}: DropdownTileProps) => {
  return (
    <div
      className="rcw-dropdown-tile-container"
      data-testid="horizontal-tile"
    >
      <div className="body">

        <div className="combo-field">
          <Text>
            Material
          </Text>
          <ComboBox
            options={columnOptions}
            value={materialValue}
            onChange={onMaterialChange}

            inputProps={{
              id: "element-combo-input",
              placeholder: "Element",
            }}
          />
        </div>

        <div className="combo-field">
          <Text>
            Quantity
          </Text>
          <ComboBox
            options={columnOptions}
            value={quantityValue}
            onChange={onQuantityChange}

            inputProps={{
              id: "quantity-combo-input",
              placeholder: "Quantity",
            }}
          />
        </div>

        <div className="action-button" data-testid="tile-action-button">
          {actionGroup}
        </div>

      </div>
    </div>
  );
};
