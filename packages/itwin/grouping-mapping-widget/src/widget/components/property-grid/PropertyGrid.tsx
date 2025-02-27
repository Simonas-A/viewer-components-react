/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import classnames from "classnames";
import { produce } from "immer";
import * as React from "react";
import type { DisposeFunc } from "@itwin/core-bentley";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  CommonPropertyGridProps,
  PropertyCategory,
  PropertyData,
} from "@itwin/components-react";
import {
  PropertyCategoryBlock,
  PropertyGridCommons,
  PropertyGridEventsRelatedPropsSupplier,
} from "@itwin/components-react";
import type { ColumnResizeRelatedPropertyListProps } from "@itwin/components-react/lib/cjs/components-react/propertygrid/component/ColumnResizingPropertyListPropsSupplier";
import { ColumnResizingPropertyListPropsSupplier } from "@itwin/components-react/lib/cjs/components-react/propertygrid/component/ColumnResizingPropertyListPropsSupplier";
import { Orientation, ResizableContainerObserver } from "@itwin/core-react";

import type { PropertyListProps } from "./PropertyList";
import { PropertyList } from "./PropertyList";
import "./PropertyGrid.scss";

import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { GroupQueryBuilderContext } from "../context/GroupQueryBuilderContext";
import { ProgressRadial } from "@itwin/itwinui-react";

/** Properties for [[PropertyGrid]] React component
 * @public
 */
export interface PropertyGridProps extends CommonPropertyGridProps {
  /** Property data provider */
  dataProvider: PresentationPropertyDataProvider;
}

/** Property Category in the [[PropertyGrid]] state
 * @public
 * @deprecated This was part of [[PropertyGrid]] internal state and should've never been public. The component is not using it anymore.
 */
export interface PropertyGridCategory {
  propertyCategory: PropertyCategory;
  propertyCount: number;
  properties: PropertyRecord[];
}

interface CategorizedPropertyGridRecords {
  category: PropertyCategory;
  records: PropertyRecord[];
  children: CategorizedPropertyGridRecords[];
}

/** State of [[PropertyGrid]] React component
 * @internal
 */
interface PropertyGridState {
  /** List of PropertyGrid categories */
  categories: CategorizedPropertyGridRecords[];
  /** Actual orientation used by the property grid */
  orientation: Orientation;
  /** If property grid currently loading data, the loading start time  */
  loadStart?: Date;
  /** Width of PropertyGrid */
  width: number;
}

/** PropertyGrid React component.
 * @public
 */
export class PropertyGrid extends React.Component<
PropertyGridProps,
PropertyGridState
> {
  private _dataChangesListenerDisposeFunc?: DisposeFunc;
  private _isMounted = false;
  private _isInDataRequest = false;
  private _hasPendingDataRequest = false;

  static override contextType = GroupQueryBuilderContext;

  /** @internal */
  constructor(props: PropertyGridProps) {
    super(props);
    this.state = {
      categories: [],
      orientation: this.getPreferredOrientation(),
      width: 0,
    };
  }

  /** @internal */
  public override componentDidMount() {
    this._isMounted = true;
    this._dataChangesListenerDisposeFunc =
      this.props.dataProvider.onDataChanged.addListener(
        this._onPropertyDataChanged
      );

    void this.gatherData();
  }

  /** @internal */
  public override componentWillUnmount() {
    // istanbul ignore else
    if (this._dataChangesListenerDisposeFunc) {
      this._dataChangesListenerDisposeFunc();
      this._dataChangesListenerDisposeFunc = undefined;
    }
    this._isMounted = false;
  }

  public override componentDidUpdate(prevProps: PropertyGridProps) {
    if (this.props.dataProvider !== prevProps.dataProvider) {
      // istanbul ignore else
      if (this._dataChangesListenerDisposeFunc) {
        this._dataChangesListenerDisposeFunc();
      }
      this._dataChangesListenerDisposeFunc =
        this.props.dataProvider.onDataChanged.addListener(
          this._onPropertyDataChanged
        );

      void this.gatherData();
    }

    if (
      this.props.orientation !== prevProps.orientation ||
      this.props.isOrientationFixed !== prevProps.isOrientationFixed ||
      this.props.horizontalOrientationMinWidth !==
        prevProps.horizontalOrientationMinWidth
    ) {
      this.updateOrientation(this.state.width);
    }
  }

  private _onPropertyDataChanged = () => {
    void this.gatherData();
  };

  private async gatherData(): Promise<void> {
    if (this._isInDataRequest) {
      this._hasPendingDataRequest = true;
      return;
    }

    this.setState((prev) =>
      prev.loadStart ? null : { loadStart: new Date() }
    );

    this._isInDataRequest = true;
    let propertyData: PropertyData;
    try {
      propertyData = await this.props.dataProvider.getData();
    } finally {
      this._isInDataRequest = false;
    }

    if (!this._isMounted) {
      return;
    }

    if (this._hasPendingDataRequest) {
      this._hasPendingDataRequest = false;
      return this.gatherData();
    }

    this.setState((prevState) => {
      const buildCategoriesHierarchy = (
        newCategories: PropertyCategory[],
        stateCategories: CategorizedPropertyGridRecords[] | undefined
      ) =>
        newCategories.map((category): CategorizedPropertyGridRecords => {
          const matchingStateCategory = findCategory(
            stateCategories ?? [],
            category.name,
            false
          );
          return {
            category: {
              ...category,
              expand:
                matchingStateCategory?.category?.expand ?? category.expand,
            },
            records: propertyData.records[category.name] ?? [],
            children: buildCategoriesHierarchy(
              category.childCategories ?? [],
              matchingStateCategory?.children
            ),
          };
        });
      return {
        categories: buildCategoriesHierarchy(
          propertyData.categories,
          prevState.categories
        ),
        loadStart: undefined,
      };
    });
  }

  private getPreferredOrientation(): Orientation {
    return this.props.orientation !== undefined
      ? this.props.orientation
      : Orientation.Horizontal;
  }

  private _onResize = (width: number) => {
    this.updateOrientation(width);
  };

  private _onCategoryExpansionToggled = (categoryName: string) => {
    this.setState((state) => {
      return produce(state, (draft) => {
        const records = findCategory(draft.categories, categoryName, true);
        // istanbul ignore else
        if (records) {
          const category = records.category;
          category.expand = !category.expand;
        }
      });
    });
  };

  private updateOrientation(width: number): void {
    const { orientation, isOrientationFixed, horizontalOrientationMinWidth } = {
      ...this.props,
    };
    const currentOrientation = PropertyGridCommons.getCurrentOrientation(
      width,
      orientation,
      isOrientationFixed,
      horizontalOrientationMinWidth
    );

    if (
      currentOrientation !== this.state.orientation ||
      width !== this.state.width
    ) {
      this.setState({ orientation: currentOrientation, width });
    }
  }

  /** @internal */
  public override render() {
    if (this.state.loadStart) {
      return (
        <div className="gmw-components-property-grid-loader">
          <ProgressRadial indeterminate />
        </div>
      );
    }

    return (
      <div className="gmw-table-box-inner">
        <PropertyGridEventsRelatedPropsSupplier
          isPropertySelectionEnabled={
            this.props.isPropertySelectionEnabled ?? false
          }
          isPropertySelectionOnRightClickEnabled={
            this.props.isPropertySelectionOnRightClickEnabled
          }
          isPropertyEditingEnabled={this.props.isPropertyEditingEnabled}
          isPropertyHoverEnabled={this.props.isPropertyHoverEnabled ?? false}
          onPropertyContextMenu={this.props.onPropertyContextMenu}
          onPropertyUpdated={this.props.onPropertyUpdated}
          onPropertySelectionChanged={this.props.onPropertySelectionChanged}
        >
          {(selectionContext) => (
            <div
              className={classnames(
                "gmw-components-property-grid-wrapper",
                this.props.className
              )}
              style={this.props.style}
            >
              <div
                className={classnames(
                  "gmw-components-property-grid",
                  "components-smallEditor-host"
                )}
              >
                <div className= "gmw-property-categories">
                  {this.state.categories.map(
                    (categorizedRecords: CategorizedPropertyGridRecords) => (
                      <NestedCategoryBlock
                        {...selectionContext}
                        key={categorizedRecords.category.name}
                        categorizedRecords={categorizedRecords}
                        onCategoryExpansionToggled={
                          this._onCategoryExpansionToggled
                        }
                        orientation={this.state.orientation}
                        propertyValueRendererManager={
                          this.props.propertyValueRendererManager
                        }
                        actionButtonRenderers={this.props.actionButtonRenderers}
                      />
                    )
                  )}
                </div>
              </div>
              <ResizableContainerObserver onResize={this._onResize} />
            </div>
          )}
        </PropertyGridEventsRelatedPropsSupplier>
      </div>
    );
  }
}

function findCategory(
  categories: CategorizedPropertyGridRecords[],
  lookupName: string,
  recurseIntoChildren: boolean
): CategorizedPropertyGridRecords | undefined {
  for (const category of categories) {
    if (category.category.name === lookupName) {
      return category;
    }
    if (recurseIntoChildren) {
      const matchingChild = findCategory(
        category.children,
        lookupName,
        recurseIntoChildren
      );
      if (matchingChild) {
        return matchingChild;
      }
    }
  }
  return undefined;
}

interface NestedCategoryBlockProps
  extends Omit<
  PropertyListProps,
  keyof ColumnResizeRelatedPropertyListProps | "properties"
  > {
  categorizedRecords: CategorizedPropertyGridRecords;
  onCategoryExpansionToggled: (categoryName: string) => void;
  orientation: Orientation;
}
const NestedCategoryBlock = (props: NestedCategoryBlockProps) => {
  const [width, setWidth] = React.useState(1);
  return (
    <PropertyCategoryBlock
      category={props.categorizedRecords.category}
      onExpansionToggled={props.onCategoryExpansionToggled}
    >
      {props.categorizedRecords.records.length ? (
        <ColumnResizingPropertyListPropsSupplier
          orientation={props.orientation}
          width={width}
        >
          {(partialListProps: ColumnResizeRelatedPropertyListProps) => (
            <PropertyList
              {...partialListProps}
              orientation={props.orientation}
              category={props.categorizedRecords.category}
              properties={props.categorizedRecords.records}
              selectedPropertyKey={props.selectedPropertyKey}
              onPropertyClicked={props.onPropertyClicked}
              onPropertyRightClicked={props.onPropertyRightClicked}
              onPropertyContextMenu={props.onPropertyContextMenu}
              propertyValueRendererManager={props.propertyValueRendererManager}
              editingPropertyKey={props.editingPropertyKey}
              onEditCommit={props.onEditCommit}
              onEditCancel={props.onEditCancel}
              isPropertyHoverEnabled={props.isPropertyHoverEnabled}
              isPropertySelectionEnabled={props.isPropertySelectionEnabled}
              isPropertyRightClickSelectionEnabled={
                props.isPropertyRightClickSelectionEnabled
              }
              actionButtonRenderers={props.actionButtonRenderers}
              setWidth={setWidth}
              width={width}
            />
          )}
        </ColumnResizingPropertyListPropsSupplier>
      ) : undefined}
      {props.categorizedRecords.children.length ? (
        <div className="gmw-property-categories">
          {props.categorizedRecords.children.map((categorizedChildRecords) => (
            <NestedCategoryBlock
              {...props}
              key={categorizedChildRecords.category.name}
              categorizedRecords={categorizedChildRecords}
            />
          ))}
        </div>
      ) : undefined}
    </PropertyCategoryBlock>
  );
};
